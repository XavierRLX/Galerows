package com.galerows.app;

import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.net.SocketException;

/** Capacitor lifecycle and event bridge for the Android LAN socket server. */
@CapacitorPlugin(name = "GalerowsLanServer")
public class LanServerPlugin extends Plugin {
    private static final int MAX_BYTES = 16 * 1024;
    private volatile LanSocketServer server;
    private volatile LanTlsIdentity tlsIdentity;
    private volatile LanHelloAuthenticator helloAuthenticator;
    private final Handler expiryHandler = new Handler(Looper.getMainLooper());
    private Runnable v2ExpiryTask;

    @PluginMethod
    public synchronized void start(PluginCall call) {
        if (!cleartextPocAllowed(getContext())) {
            call.reject("cleartext_poc_unavailable");
            return;
        }
        startServer(call, false);
    }

    static boolean cleartextPocAllowed(Context context) {
        try {
            ApplicationInfo info = context.getPackageManager().getApplicationInfo(
                context.getPackageName(), PackageManager.GET_META_DATA);
            return (info.flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0
                && info.metaData != null
                && info.metaData.getBoolean("com.galerows.app.ALLOW_CLEARTEXT_POC", false);
        } catch (PackageManager.NameNotFoundException error) {
            return false;
        }
    }

    @PluginMethod
    public synchronized void startSecure(PluginCall call) {
        startServer(call, true);
    }

    /** Resolve on each request so hotspot and Wi-Fi address changes are visible to the UI. */
    @PluginMethod
    public void discoverLanAddress(PluginCall call) {
        try {
            LanAddressDiscovery.Address address = LanAddressDiscovery.discover(call.getBoolean("preferHotspot", true));
            if (address == null) {
                call.reject("lan_interface_unavailable");
                return;
            }
            JSObject result = new JSObject();
            result.put("ip", address.ip);
            result.put("interfaceName", address.interfaceName);
            call.resolve(result);
        } catch (SocketException | SecurityException error) {
            call.reject("lan_interface_unavailable");
        }
    }

    /** Changes only the token for future TLS sockets; existing peers remain connected. */
    @PluginMethod
    public synchronized void rotateInviteToken(PluginCall call) {
        LanHelloAuthenticator gate = helloAuthenticator;
        if (gate == null || tlsIdentity == null || server == null || !server.isRunning()) {
            call.reject("secure_server_not_running");
            return;
        }
        try {
            gate.rotate(call.getString("inviteToken"));
            call.resolve();
        } catch (IllegalArgumentException error) {
            call.reject("invalid_token");
        }
    }

    @PluginMethod
    public synchronized void registerResumeToken(PluginCall call) {
        LanHelloAuthenticator gate = secureGate(call);
        if (gate == null) return;
        Long expiresAt = call.getLong("expiresAt");
        if (expiresAt == null) { call.reject("invalid_resume_credential"); return; }
        try {
            gate.registerResumeToken(call.getString("playerId"), call.getString("resumeToken"), expiresAt);
            call.resolve();
        } catch (IllegalArgumentException error) { call.reject(error.getMessage()); }
    }

    @PluginMethod
    public synchronized void revokeResumeToken(PluginCall call) {
        LanHelloAuthenticator gate = secureGate(call);
        if (gate == null) return;
        try {
            gate.revokeResumeToken(call.getString("playerId"), call.getString("resumeToken"));
            call.resolve();
        } catch (IllegalArgumentException error) { call.reject(error.getMessage()); }
    }

    @PluginMethod
    public synchronized void closePeer(PluginCall call) {
        if (secureGate(call) == null) return;
        String peerId = call.getString("peerId");
        if (peerId == null || !peerId.matches("[0-9a-fA-F-]{36}")) {
            call.reject("invalid_peer_id"); return;
        }
        try { server.closePeer(peerId); call.resolve(); }
        catch (Exception error) { call.reject("peer_not_found"); }
    }

    private LanHelloAuthenticator secureGate(PluginCall call) {
        LanHelloAuthenticator gate = helloAuthenticator;
        if (gate == null || tlsIdentity == null || server == null || !server.isRunning()) {
            call.reject("secure_server_not_running");
            return null;
        }
        return gate;
    }

    private void startServer(PluginCall call, boolean secure) {
        if (server != null && server.isRunning()) {
            call.reject("already_running");
            return;
        }
        String roomId = call.getString("roomId");
        String inviteToken = call.getString("inviteToken");
        if (roomId == null || roomId.isEmpty() || inviteToken == null || inviteToken.length() < 16) {
            call.reject("invalid_room_or_token");
            return;
        }
        int port = call.getInt("port", 0);
        if (port < 0 || port > 65535) {
            call.reject("invalid_port");
            return;
        }
        LanTlsIdentity identity = null;
        try {
            if (secure) identity = LanTlsIdentity.createEphemeral();
        } catch (Exception error) {
            call.reject("lan_tls_identity_failed");
            return;
        }
        // Version belongs to this Room and is checked by the native handshake.
        // Existing v1 callers omit the option; v2 is opt-in and secure-only.
        int protocolVersion = call.getInt("protocolVersion", 1);
        if ((protocolVersion != 1 && protocolVersion != 2) || (!secure && protocolVersion != 1)) {
            if (identity != null) try { identity.close(); } catch (Exception ignored) { }
            call.reject("incompatible_protocol");
            return;
        }
        LanHelloAuthenticator gate = new LanHelloAuthenticator(roomId, inviteToken, protocolVersion);
        LanSocketServer instance = new LanSocketServer(gate, event -> {
            JSObject payload = new JSObject();
            payload.put("type", event.type);
            payload.put("peerId", event.peerId);
            if (event.data != null) payload.put("data", event.data);
            notifyListeners("lanEvent", payload);
        }, secure ? identity.serverSocketFactory() : javax.net.ServerSocketFactory.getDefault());
        try {
            int boundPort = instance.start(port);
            server = instance;
            tlsIdentity = identity;
            helloAuthenticator = gate;
            long delayMs = LanV2RoomLifetimePolicy.watchdogDelayMs(protocolVersion);
            if (delayMs > 0) {
                // Native watchdog also works when the JS WebView's timer has been suspended.
                Runnable task = () -> {
                    synchronized (LanServerPlugin.this) {
                        if (server == instance) {
                            JSObject expired = new JSObject();
                            expired.put("type", "room_expired");
                            expired.put("peerId", "");
                            notifyListeners("lanEvent", expired);
                            shutdown();
                        }
                    }
                };
                v2ExpiryTask = task;
                expiryHandler.postDelayed(task, delayMs);
            }
            JSObject result = new JSObject();
            result.put("port", boundPort);
            if (identity != null) result.put("fingerprint", identity.fingerprint());
            call.resolve(result);
        } catch (Exception error) {
            instance.stop();
            if (identity != null) try { identity.close(); } catch (Exception ignored) { }
            call.reject("lan_server_start_failed");
        }
    }

    @PluginMethod
    public synchronized void stop(PluginCall call) {
        shutdown();
        call.resolve();
    }

    @PluginMethod
    public void send(PluginCall call) {
        String peerId = call.getString("peerId");
        String message = call.getString("data");
        if (peerId == null || message == null || message.getBytes(StandardCharsets.UTF_8).length > MAX_BYTES) {
            call.reject("invalid_send");
            return;
        }
        LanSocketServer current = server;
        if (current == null || !current.isRunning()) {
            call.reject("peer_not_found");
            return;
        }
        Thread sender = new Thread(() -> {
            try {
                current.send(peerId, message);
                call.resolve();
            } catch (Exception error) {
                call.reject("lan_send_failed", error);
            }
        }, "galerows-lan-send");
        sender.setDaemon(true);
        sender.start();
    }

    private synchronized void shutdown() {
        if (v2ExpiryTask != null) {
            expiryHandler.removeCallbacks(v2ExpiryTask);
            v2ExpiryTask = null;
        }
        LanSocketServer current = server;
        server = null;
        helloAuthenticator = null;
        if (current != null) current.stop();
        LanTlsIdentity identity = tlsIdentity;
        tlsIdentity = null;
        if (identity != null) try { identity.close(); } catch (Exception ignored) { }
    }

    @Override
    protected void handleOnDestroy() {
        shutdown();
        super.handleOnDestroy();
    }
}
