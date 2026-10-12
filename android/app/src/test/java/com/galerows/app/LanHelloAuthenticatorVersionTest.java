package com.galerows.app;

import org.junit.Test;
import static org.junit.Assert.*;

/** PL-02B: version is a property of one secure Room, never a silent v1/v2 downgrade. */
public class LanHelloAuthenticatorVersionTest {
    private static final String TOKEN = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    private static final String RESUME = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

    private static String hello(int version, String room, String token) {
        return "{\"kind\":\"hello\",\"protocolVersion\":" + version + ",\"roomId\":\"" + room
            + "\",\"inviteToken\":\"" + token + "\"}";
    }

    private static String resume(int version, String room, String playerId, String token) {
        return "{\"kind\":\"resumeHello\",\"protocolVersion\":" + version + ",\"roomId\":\"" + room
            + "\",\"playerId\":\"" + playerId + "\",\"resumeToken\":\"" + token + "\"}";
    }

    @Test public void defaultRoomRemainsV1AndRejectsV2() {
        LanHelloAuthenticator v1 = new LanHelloAuthenticator("room", TOKEN);
        assertTrue(v1.test(hello(1, "room", TOKEN)));
        assertFalse(v1.test(hello(2, "room", TOKEN)));
        assertFalse(v1.test(hello(3, "room", TOKEN)));
    }

    @Test public void secureRoomV2RejectsV1WithoutDowngrade() {
        LanHelloAuthenticator v2 = new LanHelloAuthenticator("room", TOKEN, 2);
        assertTrue(v2.test(hello(2, "room", TOKEN)));
        assertFalse(v2.test(hello(1, "room", TOKEN)));
        assertFalse(v2.test(hello(3, "room", TOKEN)));
        assertFalse(v2.test(hello(2, "other", TOKEN)));
        assertFalse(v2.test(hello(2, "room", RESUME)));
    }

    @Test public void resumptionIsBoundToVersionAndPlayer() {
        LanHelloAuthenticator v2 = new LanHelloAuthenticator("room", TOKEN, 2);
        v2.registerResumeToken("guest", RESUME, System.currentTimeMillis() + 60_000);
        assertTrue(v2.test(resume(2, "room", "guest", RESUME)));
        assertFalse(v2.test(resume(1, "room", "guest", RESUME)));
        assertFalse(v2.test(resume(2, "room", "other", RESUME)));
        v2.revokeResumeToken("guest", RESUME);
        assertFalse(v2.test(resume(2, "room", "guest", RESUME)));
    }

    @Test public void unsupportedRoomVersionFailsClosed() {
        for (int version : new int[]{0, -1, 3, 10}) {
            try { new LanHelloAuthenticator("room", TOKEN, version); fail("version " + version); }
            catch (IllegalArgumentException expected) { }
        }
    }
}
