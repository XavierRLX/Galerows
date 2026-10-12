package com.galerows.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import java.util.Arrays;
import java.util.Collections;
import org.junit.Test;

public class LanAddressDiscoveryTest {
    @Test
    public void legacyCallWithoutNetworkPreferenceStillChoosesHotspot() {
        LanAddressDiscovery.Address selected = LanAddressDiscovery.select(Arrays.asList(
            new LanAddressDiscovery.Address("wlan0", "192.168.0.84"),
            new LanAddressDiscovery.Address("swlan0", "10.245.112.98")));
        assertEquals("swlan0", selected.interfaceName);
    }

    @Test
    public void explicitWifiPreferenceChoosesWifiWhenBothInterfacesAreActive() {
        LanAddressDiscovery.Address selected = LanAddressDiscovery.select(Arrays.asList(
            new LanAddressDiscovery.Address("wlan0", "192.168.1.4"),
            new LanAddressDiscovery.Address("swlan0", "10.245.112.98")), false);
        assertEquals("wlan0", selected.interfaceName);
        assertEquals("192.168.1.4", selected.ip);
        assertEquals("swlan0", LanAddressDiscovery.select(Arrays.asList(
            new LanAddressDiscovery.Address("wlan0", "192.168.1.4"),
            new LanAddressDiscovery.Address("swlan0", "10.245.112.98")), true).interfaceName);
    }

    @Test
    public void acceptsWifiPrivateIpv4AndRejectsOtherInterfaces() {
        LanAddressDiscovery.Address selected = LanAddressDiscovery.select(Arrays.asList(
            new LanAddressDiscovery.Address("lo", "127.0.0.1"),
            new LanAddressDiscovery.Address("rmnet_data0", "10.1.2.3"),
            new LanAddressDiscovery.Address("tun0", "10.8.0.2"),
            new LanAddressDiscovery.Address("wlan0", "172.16.1.5")));
        assertEquals("172.16.1.5", selected.ip);
    }

    @Test
    public void rejectsPublicLinkLocalAndIpv6Addresses() {
        assertNull(LanAddressDiscovery.select(Arrays.asList(
            new LanAddressDiscovery.Address("wlan0", "8.8.8.8"),
            new LanAddressDiscovery.Address("swlan0", "169.254.1.2"),
            new LanAddressDiscovery.Address("ap0", "fe80::1"))));
        assertNull(LanAddressDiscovery.select(Collections.emptyList()));
    }

    @Test
    public void hotspotAliasesAndAddressChangesAreReevaluated() {
        assertEquals("192.168.43.1", LanAddressDiscovery.select(Arrays.asList(
            new LanAddressDiscovery.Address("ap0", "192.168.43.1"),
            new LanAddressDiscovery.Address("wlan0", "192.168.1.2"))).ip);
        assertEquals("192.168.44.1", LanAddressDiscovery.select(Collections.singletonList(
            new LanAddressDiscovery.Address("ap0", "192.168.44.1"))).ip);
    }
}
