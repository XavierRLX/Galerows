package com.galerows.app;

import android.content.Context;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.net.wifi.WifiManager;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/**
 * G3 read-only DNS-SD discovery. NSD broadcasts are UNTRUSTED advertisements, not
 * a Room capability or host authentication. Admission remains QR/WSS-pinned PL-03.
 */
@CapacitorPlugin(name = "GalerowsRoomDiscovery")
public class LanRoomDiscoveryPlugin extends Plugin {
    private static final int MAX_DISCOVERY_QUEUE = 48;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ArrayDeque<NsdServiceInfo> queue = new ArrayDeque<>();
    private final Set<String> visible = new HashSet<>();
    private final Set<String> vanished = new HashSet<>();
    private NsdManager nsd;
    private NsdManager.DiscoveryListener discovery;
    private WifiManager.MulticastLock multicastLock;
    private boolean scanning;
    private boolean resolving;
    private int generation;

    @PluginMethod public void startScan(PluginCall call) {
        handler.post(() -> {
            if (scanning) { call.resolve(); return; }
            nsd = (NsdManager) getContext().getSystemService(Context.NSD_SERVICE);
            if (nsd == null) { call.reject("lan_discovery_unavailable"); return; }
            final int session = ++generation;
            scanning = true;
            queue.clear();
            visible.clear();
            vanished.clear();
            resolving = false;
            try {
                WifiManager wifi = (WifiManager) getContext().getApplicationContext()
                    .getSystemService(Context.WIFI_SERVICE);
                if (wifi != null) {
                    multicastLock = wifi.createMulticastLock("galerows-nsd-foreground");
                    multicastLock.setReferenceCounted(false);
                    multicastLock.acquire();
                }
                discovery = new NsdManager.DiscoveryListener() {
                    @Override public void onDiscoveryStarted(String type) { }
                    @Override public void onDiscoveryStopped(String type) { }
                    @Override public void onStartDiscoveryFailed(String type, int errorCode) {
                        handler.post(() -> {
                            if (!isCurrent(session)) return;
                            sendEvent("error", null, null);
                            stopScanInternal();
                        });
                    }
                    @Override public void onStopDiscoveryFailed(String type, int errorCode) { }
                    @Override public void onServiceFound(NsdServiceInfo info) {
                        handler.post(() -> {
                            if (!isCurrent(session)) return;
                            String id = info.getServiceName();
                            if (id == null || !id.startsWith("Galerows-") || id.length() > 60) return;
                            vanished.remove(id);
                            if (queue.size() >= MAX_DISCOVERY_QUEUE) return;
                            queue.addLast(info);
                            resolveNext(session);
                        });
                    }
                    @Override public void onServiceLost(NsdServiceInfo info) {
                        handler.post(() -> {
                            if (!isCurrent(session)) return;
                            String id = info.getServiceName();
                            if (id == null) return;
                            vanished.add(id);
                            queue.removeIf(item -> id.equals(item.getServiceName()));
                            if (visible.remove(id)) sendEvent("lost", id, null);
                        });
                    }
                };
                nsd.discoverServices(LanRoomNsdPublisher.SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, discovery);
                call.resolve();
            } catch (SecurityException error) {
                stopScanInternal();
                call.reject("lan_discovery_permission_denied");
            } catch (RuntimeException error) {
                stopScanInternal();
                call.reject("lan_discovery_unavailable");
            }
        });
    }

    @PluginMethod public void stopScan(PluginCall call) {
        handler.post(() -> { stopScanInternal(); call.resolve(); });
    }

    private boolean isCurrent(int session) { return scanning && generation == session; }

    private void resolveNext(int session) {
        if (!isCurrent(session) || resolving || queue.isEmpty()) return;
        final NsdServiceInfo candidate = queue.removeFirst();
        final String id = candidate.getServiceName();
        if (vanished.contains(id) || visible.contains(id)) { resolveNext(session); return; }
        resolving = true;
        try {
            nsd.resolveService(candidate, new NsdManager.ResolveListener() {
                @Override public void onResolveFailed(NsdServiceInfo info, int code) {
                    handler.post(() -> {
                        if (!isCurrent(session)) return;
                        resolving = false;
                        resolveNext(session);
                    });
                }
                @Override public void onServiceResolved(NsdServiceInfo info) {
                    handler.post(() -> {
                        if (!isCurrent(session)) return;
                        resolving = false;
                        if (!vanished.contains(id) && validResolved(info) && visible.add(id)) {
                            sendRoomFound(id, info);
                        }
                        resolveNext(session);
                    });
                }
            });
        } catch (RuntimeException ignored) {
            resolving = false;
            resolveNext(session);
        }
    }

    /** Only publish validated, bounded, public v2 metadata to JavaScript. */
    private static boolean validResolved(NsdServiceInfo info) {
        if (info.getPort() < 1 || info.getPort() > 65535) return false;
        String name = info.getServiceName();
        if (name == null || !name.matches("Galerows-[A-Za-z0-9]{4,16}")) return false;
        Map<String, byte[]> attributes = info.getAttributes();
        byte[] app = attributes.get("app");
        byte[] version = attributes.get("v");
        byte[] code = attributes.get("code");
        byte[] room = attributes.get("room");
        byte[] fingerprint = attributes.get("fp");
        if (app == null || version == null || code == null || room == null || fingerprint == null
            || app.length > 16 || version.length != 1 || room.length > 64 || fingerprint.length != 64
            || code.length != 6 || info.getHost() == null) return false;
        String hostIp = info.getHost().getHostAddress();
        return "galerows".equals(new String(app, StandardCharsets.UTF_8))
            && "2".equals(new String(version, StandardCharsets.UTF_8))
            && new String(code, StandardCharsets.UTF_8).matches("[0-9]{6}")
            && new String(room, StandardCharsets.UTF_8).matches("[A-Za-z0-9_-]{1,64}")
            && new String(fingerprint, StandardCharsets.UTF_8).matches("[0-9a-f]{64}")
            && hostIp != null && hostIp.matches("[0-9.]{7,15}") && isPrivateIpv4(hostIp);
    }

    private static boolean isPrivateIpv4(String address) {
        String[] parts = address.split("\\.");
        if (parts.length != 4) return false;
        try {
            int[] n = new int[4];
            for (int i = 0; i < 4; i++) {
                n[i] = Integer.parseInt(parts[i]);
                if (n[i] < 0 || n[i] > 255) return false;
            }
            return n[0] == 10 || (n[0] == 172 && n[1] >= 16 && n[1] <= 31)
                || (n[0] == 192 && n[1] == 168) || (n[0] == 169 && n[1] == 254)
                || (n[0] == 100 && n[1] >= 64 && n[1] <= 127);
        } catch (NumberFormatException error) { return false; }
    }

    /** Public DNS-SD fields; advertisements are not host identity proof. */
    private void sendRoomFound(String id, NsdServiceInfo roomInfo) {
        JSObject data = new JSObject();
        data.put("type", "found");
        data.put("id", id);
        data.put("label", roomInfo.getServiceName());
        data.put("roomId", new String(roomInfo.getAttributes().get("room"), StandardCharsets.UTF_8));
        data.put("code", new String(roomInfo.getAttributes().get("code"), StandardCharsets.UTF_8));
        data.put("fingerprint", new String(roomInfo.getAttributes().get("fp"), StandardCharsets.UTF_8));
        data.put("hostIp", roomInfo.getHost().getHostAddress());
        data.put("port", roomInfo.getPort());
        notifyListeners("lanRoomDiscovery", data);
    }

    private void sendEvent(String kind, String id, String name) {
        JSObject payload = new JSObject();
        payload.put("type", kind);
        if (id != null) payload.put("id", id);
        if (name != null) payload.put("label", name);
        notifyListeners("lanRoomDiscovery", payload);
    }

    private void stopScanInternal() {
        generation++;
        scanning = false;
        resolving = false;
        queue.clear();
        visible.clear();
        vanished.clear();
        NsdManager.DiscoveryListener old = discovery;
        discovery = null;
        if (old != null && nsd != null) {
            try { nsd.stopServiceDiscovery(old); }
            catch (RuntimeException ignored) { }
        }
        if (multicastLock != null) {
            try { if (multicastLock.isHeld()) multicastLock.release(); }
            catch (RuntimeException ignored) { }
            multicastLock = null;
        }
    }

    @Override protected void handleOnDestroy() {
        handler.post(this::stopScanInternal);
        super.handleOnDestroy();
    }
}
