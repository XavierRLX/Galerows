package com.galerows.app;

import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.SocketException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Enumeration;
import java.util.List;
import java.util.Locale;

/** Finds an address reachable by another device on Wi-Fi or an Android hotspot. */
final class LanAddressDiscovery {
    static final class Address {
        final String interfaceName;
        final String ip;

        Address(String interfaceName, String ip) {
            this.interfaceName = interfaceName;
            this.ip = ip;
        }
    }

    private LanAddressDiscovery() { }

    static Address discover() throws SocketException { return discover(true); }

    static Address discover(boolean preferHotspot) throws SocketException {
        List<Address> candidates = new ArrayList<>();
        Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
        if (interfaces == null) return null;
        for (NetworkInterface networkInterface : Collections.list(interfaces)) {
            if (!networkInterface.isUp() || networkInterface.isLoopback()) continue;
            for (InetAddress address : Collections.list(networkInterface.getInetAddresses())) {
                if (address instanceof Inet4Address) {
                    candidates.add(new Address(networkInterface.getName(), address.getHostAddress()));
                }
            }
        }
        return select(candidates, preferHotspot);
    }

    static Address select(List<Address> candidates) { return select(candidates, true); }

    static Address select(List<Address> candidates, boolean preferHotspot) {
        Address best = null;
        int bestRank = Integer.MAX_VALUE;
        for (Address candidate : candidates) {
            int rank = rank(candidate.interfaceName, preferHotspot);
            if (rank == Integer.MAX_VALUE || !privateIpv4(candidate.ip)) continue;
            if (best == null || rank < bestRank
                || (rank == bestRank && candidate.interfaceName.compareTo(best.interfaceName) < 0)) {
                best = candidate;
                bestRank = rank;
            }
        }
        return best;
    }

    private static int rank(String name, boolean preferHotspot) {
        if (name == null) return Integer.MAX_VALUE;
        String normalized = name.toLowerCase(Locale.ROOT);
        if (normalized.startsWith("swlan") || normalized.startsWith("softap")
            || normalized.startsWith("ap")) return preferHotspot ? 0 : 1;
        if (normalized.startsWith("wlan") || normalized.startsWith("wifi")) return preferHotspot ? 1 : 0;
        return Integer.MAX_VALUE;
    }

    private static boolean privateIpv4(String ip) {
        if (ip == null) return false;
        String[] parts = ip.split("\\.", -1);
        if (parts.length != 4) return false;
        int[] octets = new int[4];
        for (int i = 0; i < parts.length; i++) {
            if (parts[i].isEmpty() || parts[i].length() > 3) return false;
            for (int j = 0; j < parts[i].length(); j++) {
                if (parts[i].charAt(j) < '0' || parts[i].charAt(j) > '9') return false;
            }
            octets[i] = Integer.parseInt(parts[i]);
            if (octets[i] > 255) return false;
        }
        return octets[0] == 10
            || octets[0] == 172 && octets[1] >= 16 && octets[1] <= 31
            || octets[0] == 192 && octets[1] == 168;
    }
}
