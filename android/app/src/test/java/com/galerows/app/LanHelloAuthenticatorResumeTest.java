package com.galerows.app;

import org.junit.Test;
import static org.junit.Assert.*;

public class LanHelloAuthenticatorResumeTest {
    private static final String A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    private static final String B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    private static final String C = "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";

    private String hello(String player, String token) {
        return "{\"kind\":\"resumeHello\",\"protocolVersion\":1,\"roomId\":\"r\",\"playerId\":\"" + player
            + "\",\"resumeToken\":\"" + token + "\"}";
    }

    @Test public void registeredTokensAreScopedRotatableAndExpire() throws Exception {
        LanHelloAuthenticator gate = new LanHelloAuthenticator("r", A);
        long future = System.currentTimeMillis() + 60000;
        gate.registerResumeToken("p", A, future);
        gate.registerResumeToken("p", B, future);
        assertTrue(gate.test(hello("p", A)));
        assertTrue(gate.test(hello("p", B)));
        assertFalse(gate.test(hello("q", A)));
        assertFalse(gate.test(hello("p", C)));
        gate.registerResumeToken("p", C, future);
        assertFalse(gate.test(hello("p", A)));
        assertTrue(gate.test(hello("p", B)));
        gate.revokeResumeToken("p", B);
        assertFalse(gate.test(hello("p", B)));
        gate.registerResumeToken("p", A, System.currentTimeMillis() + 100);
        Thread.sleep(150);
        assertFalse(gate.test(hello("p", A)));
        assertFalse(gate.test(hello("p", C).replace("\"roomId\":\"r\"", "\"roomId\":\"other\"")));
    }

    @Test public void malformedCredentialsRejected() {
        LanHelloAuthenticator gate = new LanHelloAuthenticator("r", A);
        try { gate.registerResumeToken("p", "short", System.currentTimeMillis() + 1000); fail(); }
        catch (IllegalArgumentException expected) { }
        try { gate.registerResumeToken("p", A, System.currentTimeMillis() - 1); fail(); }
        catch (IllegalArgumentException expected) { }
        try { gate.registerResumeToken("p", A, System.currentTimeMillis() + 48L * 60 * 60 * 1000); fail(); }
        catch (IllegalArgumentException expected) { }
    }

    @Test public void registryIsBoundedAndInviteHelloStillWorks() {
        LanHelloAuthenticator gate = new LanHelloAuthenticator("r", A);
        long future = System.currentTimeMillis() + 60000;
        for (int i = 0; i < 16; i++) gate.registerResumeToken("p" + i, A, future);
        try { gate.registerResumeToken("overflow", B, future); fail(); }
        catch (IllegalArgumentException expected) { }
        assertTrue(gate.test("{\"kind\":\"hello\",\"protocolVersion\":1,\"roomId\":\"r\",\"inviteToken\":\"" + A + "\"}"));
        gate.rotate(B);
        assertFalse(gate.test("{\"kind\":\"hello\",\"protocolVersion\":1,\"roomId\":\"r\",\"inviteToken\":\"" + A + "\"}"));
        assertTrue(gate.test(hello("p0", A)));
    }
}
