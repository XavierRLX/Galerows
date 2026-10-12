package com.galerows.app;

/** Native backstop for the Android Room v2 TLS certificate's 24-hour validity.
 * The JavaScript watchdog uses the same 23-hour bound but can be suspended in background.
 */
final class LanV2RoomLifetimePolicy {
    static final long MAX_V2_ROOM_AGE_MS = 23L * 60 * 60 * 1000;
    private LanV2RoomLifetimePolicy() { }

    static long watchdogDelayMs(int protocolVersion) {
        return protocolVersion == 2 ? MAX_V2_ROOM_AGE_MS : 0L;
    }
}
