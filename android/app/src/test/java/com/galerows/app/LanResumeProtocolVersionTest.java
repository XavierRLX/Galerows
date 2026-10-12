package com.galerows.app;

import org.junit.Test;
import org.json.JSONObject;
import static org.junit.Assert.*;

/** Durable credentials must bind resumeHello to the selected Room protocol version. */
public class LanResumeProtocolVersionTest {
    private static final String TOKEN = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    private static final String NEXT = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    private static final String PIN = "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";

    private JSONObject credential(int version) throws Exception {
        return new JSONObject().put("roomId", "room").put("playerId", "guest")
            .put("resumeToken", TOKEN).put("expiresAt", System.currentTimeMillis() + 60_000)
            .put("host", "10.245.112.98").put("port", 12345).put("fingerprint", PIN)
            .put("protocolVersion", version);
    }

    @Test public void olderStoredCredentialWithoutVersionIsStillV1() throws Exception {
        JSONObject legacy = credential(1);
        legacy.remove("protocolVersion");
        assertEquals(1, LanResumeCredentialVault.credentialProtocolVersion(legacy));
        JSONObject rotated = LanResumeCredentialVault.rotatedCredential(
            legacy, "room", "guest", NEXT, System.currentTimeMillis() + 60_000);
        assertEquals(1, LanResumeCredentialVault.credentialProtocolVersion(rotated));
    }

    @Test public void v2RotationPreservesPinnedEndpointAndProtocol() throws Exception {
        JSONObject stored = credential(2);
        assertEquals(2, LanResumeCredentialVault.credentialProtocolVersion(stored));
        JSONObject rotated = LanResumeCredentialVault.rotatedCredential(
            stored, "room", "guest", NEXT, System.currentTimeMillis() + 60_000);
        assertEquals(2, rotated.getInt("protocolVersion"));
        assertEquals(PIN, rotated.getString("fingerprint"));
        assertEquals("10.245.112.98", rotated.getString("host"));
        assertEquals(NEXT, rotated.getString("resumeToken"));
    }

    @Test public void unsupportedVersionsCannotBeStoredOrResumed() throws Exception {
        for (int version : new int[]{0, 3, -1, 99}) {
            try { LanResumeCredentialVault.credentialProtocolVersion(credential(version)); fail(); }
            catch (IllegalArgumentException expected) { }
            try { LanResumeCredentialVault.validate("room", "guest", TOKEN,
                System.currentTimeMillis() + 60_000, "10.245.112.98", 12345, PIN, version); fail(); }
            catch (IllegalArgumentException expected) { }
        }
    }
}
