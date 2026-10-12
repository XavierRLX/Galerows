package com.galerows.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

/** Capacitor bridge for the pinned native WSS client. */
@CapacitorPlugin(name = "GalerowsLanSecureClient")
public class LanSecureClientPlugin extends Plugin {
    private volatile LanSecureClient client;
    private boolean connecting;
    private long generation;

    @PluginMethod
    public synchronized void connect(PluginCall call) {
        String host = call.getString("host");
        int port = call.getInt("port", 0);
        String fingerprint = call.getString("fingerprint");
        String hello = call.getString("hello");
        connectTo(call, host, port, fingerprint, hello);
    }

    @PluginMethod
    public void storeResumeCredential(PluginCall call) {
        Long expiresAt = call.getLong("expiresAt");
        if (expiresAt == null) { call.reject("invalid_resume_credential"); return; }
        try {
            new LanResumeCredentialVault(getContext()).store(call.getString("roomId"),
                call.getString("playerId"), call.getString("resumeToken"), expiresAt,
                call.getString("host"), call.getInt("port", 0), call.getString("fingerprint"),
                call.getInt("protocolVersion", 1));
            call.resolve();
        } catch (IllegalArgumentException error) { call.reject("invalid_resume_credential"); }
          catch (Exception error) { call.reject("resume_vault_failed"); }
    }

    @PluginMethod
    public void rotateResumeCredential(PluginCall call) {
        Long expiresAt = call.getLong("expiresAt");
        if (expiresAt == null) { call.reject("invalid_resume_credential"); return; }
        try {
            new LanResumeCredentialVault(getContext()).rotate(call.getString("roomId"),
                call.getString("playerId"), call.getString("resumeToken"), expiresAt);
            call.resolve();
        } catch (IllegalArgumentException error) { call.reject(error.getMessage()); }
          catch (Exception error) { call.reject("resume_vault_failed"); }
    }

    @PluginMethod
    public synchronized void connectResume(PluginCall call) {
        String roomId = call.getString("roomId");
        try {
            JSONObject credential = new LanResumeCredentialVault(getContext()).load(roomId);
            JSONObject hello = new JSONObject();
            hello.put("kind", "resumeHello");
            hello.put("protocolVersion", LanResumeCredentialVault.credentialProtocolVersion(credential));
            hello.put("roomId", roomId);
            hello.put("playerId", credential.getString("playerId"));
            hello.put("resumeToken", credential.getString("resumeToken"));
            connectTo(call, credential.getString("host"), credential.getInt("port"),
                credential.getString("fingerprint"), hello.toString());
        } catch (IllegalArgumentException error) { call.reject(error.getMessage()); }
          catch (Exception error) { call.reject("resume_vault_failed"); }
    }

    @PluginMethod
    public void clearResumeCredential(PluginCall call) {
        try { new LanResumeCredentialVault(getContext()).clear(call.getString("roomId")); call.resolve(); }
        catch (Exception error) { call.reject("invalid_room"); }
    }

    private synchronized void connectTo(PluginCall call, String host, int port, String fingerprint, String hello) {
        if (client != null || connecting) { call.reject("already_connected"); return; }
        if (hello == null || hello.getBytes(StandardCharsets.UTF_8).length > LanWebSocketCodec.MAX_BYTES) {
            call.reject("invalid_hello"); return;
        }
        connecting = true;
        long attempt = ++generation;
        Thread connector = new Thread(() -> {
            try {
                LanSecureClient connection = LanSecureClient.connect(host, port, fingerprint, hello,
                    message -> {
                        synchronized (LanSecureClientPlugin.this) {
                            if (generation != attempt) return;
                        }
                        JSObject event = new JSObject();
                        event.put("type", "message");
                        event.put("data", message);
                        notifyListeners("secureLanEvent", event);
                    }, status -> {
                        synchronized (LanSecureClientPlugin.this) {
                            if (generation != attempt) return;
                            if ("closed".equals(status)) client = null;
                        }
                        JSObject event = new JSObject();
                        event.put("type", status);
                        notifyListeners("secureLanEvent", event);
                    });
                synchronized (this) {
                    if (generation != attempt) {
                        connection.close();
                        call.reject("connection_cancelled");
                        return;
                    }
                    connecting = false;
                    if (connection.isClosed()) {
                        call.reject("secure_lan_connection_closed");
                        return;
                    }
                    client = connection;
                }
                call.resolve();
            } catch (LanSecureClient.HostIdentityException error) {
                synchronized (this) { if (generation == attempt) connecting = false; }
                call.reject("host_identity_mismatch");
            } catch (Exception error) {
                synchronized (this) { if (generation == attempt) connecting = false; }
                call.reject("secure_lan_connect_failed");
            }
        }, "galerows-lan-secure-connect");
        connector.setDaemon(true);
        connector.start();
    }

    @PluginMethod
    public void send(PluginCall call) {
        String data = call.getString("data");
        if (data == null) { call.reject("invalid_send"); return; }
        LanSecureClient current = client;
        if (current == null) { call.reject("not_connected"); return; }
        Thread sender = new Thread(() -> {
            try { current.send(data); call.resolve(); }
            catch (Exception error) { call.reject("secure_lan_send_failed", error); }
        }, "galerows-lan-secure-send");
        sender.setDaemon(true);
        sender.start();
    }

    @PluginMethod
    public synchronized void disconnect(PluginCall call) {
        shutdown();
        call.resolve();
    }

    private synchronized void shutdown() {
        generation++;
        connecting = false;
        LanSecureClient current = client;
        client = null;
        if (current != null) try { current.close(); } catch (Exception ignored) { }
    }

    @Override protected void handleOnDestroy() {
        shutdown();
        super.handleOnDestroy();
    }
}
