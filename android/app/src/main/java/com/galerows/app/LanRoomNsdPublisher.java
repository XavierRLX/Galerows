package com.galerows.app;

import android.content.Context;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;

/**
 * G3: non-authoritative, best-effort service advertisement.
 * The published record contains PUBLIC room locator metadata + 6-digit code.
 * It has NO QR capability, resume token, private state or TLS private key.
 * The advertised fingerprint is not independently authenticated (TOFU risk).
 */
final class LanRoomNsdPublisher {
    static final String SERVICE_TYPE = "_galerows._tcp.";
    private final NsdManager manager;
    private NsdManager.RegistrationListener registration;

    LanRoomNsdPublisher(Context context) {
        manager = (NsdManager) context.getSystemService(Context.NSD_SERVICE);
    }

    synchronized void publish(String roomId, int port, String code, String fingerprint) {
        if (manager == null || registration != null || port < 1 || port > 65535
            || code == null || !code.matches("[0-9]{6}")
            || fingerprint == null || !fingerprint.matches("[0-9a-f]{64}")) return;
        String publicSuffix = roomId.replaceAll("[^A-Za-z0-9]", "");
        if (publicSuffix.length() > 10) publicSuffix = publicSuffix.substring(publicSuffix.length() - 10);
        NsdServiceInfo info = new NsdServiceInfo();
        info.setServiceName("Galerows-" + publicSuffix);
        info.setServiceType(SERVICE_TYPE);
        info.setPort(port);
        info.setAttribute("app", "galerows");
        info.setAttribute("v", "2");
        info.setAttribute("code", code);
        info.setAttribute("room", roomId);
        info.setAttribute("fp", fingerprint);
        NsdManager.RegistrationListener listener = new NsdManager.RegistrationListener() {
            @Override public void onServiceRegistered(NsdServiceInfo serviceInfo) { }
            @Override public void onRegistrationFailed(NsdServiceInfo serviceInfo, int errorCode) { }
            @Override public void onServiceUnregistered(NsdServiceInfo serviceInfo) { }
            @Override public void onUnregistrationFailed(NsdServiceInfo serviceInfo, int errorCode) { }
        };
        registration = listener;
        try {
            manager.registerService(info, NsdManager.PROTOCOL_DNS_SD, listener);
        } catch (RuntimeException error) {
            registration = null;
        }
    }

    synchronized void stop() {
        NsdManager.RegistrationListener listener = registration;
        registration = null;
        if (manager != null && listener != null) {
            try { manager.unregisterService(listener); }
            catch (RuntimeException ignored) { /* Discovery must never crash WSS shutdown. */ }
        }
    }
}
