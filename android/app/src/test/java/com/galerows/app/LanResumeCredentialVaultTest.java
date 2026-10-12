package com.galerows.app;

import org.junit.Test;
import org.json.JSONObject;
import static org.junit.Assert.*;

public class LanResumeCredentialVaultTest {
    private static final String TOKEN = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    private static final String PIN = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

    @Test public void rejectsCredentialsThatCannotSafelyBeStored() {
        long future = System.currentTimeMillis() + 60000;
        LanResumeCredentialVault.validate("room", "player-1", TOKEN, future, "192.168.1.1", 4321, PIN);
        assertInvalid("room", "player-1", "bad", future, "192.168.1.1", 4321, PIN);
        assertInvalid("room", "player-1", TOKEN, System.currentTimeMillis() - 1, "192.168.1.1", 4321, PIN);
        assertInvalid("room", "player-1", TOKEN, System.currentTimeMillis() + 48L * 60 * 60 * 1000, "192.168.1.1", 4321, PIN);
        assertInvalid("room", "player-1", TOKEN, future, "example.com/path", 4321, PIN);
        assertInvalid("room", "player-1", TOKEN, future, "192.168.1.1", 0, PIN);
        assertInvalid("room", "player-1", TOKEN, future, "192.168.1.1", 4321, "bad");
    }

    private static void assertInvalid(String room, String player, String token, long expiry,
                                      String host, int port, String pin) {
        try { LanResumeCredentialVault.validate(room, player, token, expiry, host, port, pin); fail(); }
        catch (IllegalArgumentException expected) { }
    }

    @Test public void rotationPreservesPinnedEndpointAndRejectsOtherPlayer() throws Exception {
        long future = System.currentTimeMillis() + 60000;
        JSONObject stored = new JSONObject()
            .put("roomId", "r").put("playerId", "p")
            .put("resumeToken", TOKEN).put("expiresAt", future)
            .put("host", "192.168.1.1").put("port", 4321).put("fingerprint", PIN);
        String next = "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
        JSONObject rotated = LanResumeCredentialVault.rotatedCredential(stored, "r", "p", next, future);
        assertEquals("192.168.1.1", rotated.getString("host"));
        assertEquals(4321, rotated.getInt("port"));
        assertEquals(PIN, rotated.getString("fingerprint"));
        assertEquals(next, rotated.getString("resumeToken"));
        assertEquals(TOKEN, stored.getString("resumeToken"));
        try { LanResumeCredentialVault.rotatedCredential(stored, "r", "other", next, future); fail(); }
        catch (IllegalArgumentException expected) { }
    }
}
