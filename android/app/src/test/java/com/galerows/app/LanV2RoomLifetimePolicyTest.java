package com.galerows.app;

import org.junit.Test;
import static org.junit.Assert.*;

/** Secure Room v2 must expire well before ephemeral native TLS certificate (24h). */
public class LanV2RoomLifetimePolicyTest {
    @Test public void versionTwoRequiresNative23HourWatchdog() {
        assertEquals(23L * 60 * 60 * 1000, LanV2RoomLifetimePolicy.watchdogDelayMs(2));
    }
    @Test public void legacyVersionOneKeepsItsCurrentLifecycle() {
        assertEquals(0L, LanV2RoomLifetimePolicy.watchdogDelayMs(1));
    }
}
