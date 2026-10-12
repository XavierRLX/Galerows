package com.galerows.app;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class LanHelloAuthenticatorTest {
    @Test public void rotationRejectsOldCapabilityAndKeepsNewOneOnSameServer() {
        LanHelloAuthenticator gate = new LanHelloAuthenticator("room-1", "1234567890123456");
        String oldHello = "{\"kind\":\"hello\",\"protocolVersion\":1,\"roomId\":\"room-1\",\"inviteToken\":\"1234567890123456\"}";
        String next = "abcdef".repeat(10) + "abcd";
        String nextHello = "{\"kind\":\"hello\",\"protocolVersion\":1,\"roomId\":\"room-1\",\"inviteToken\":\"" + next + "\"}";
        assertTrue(gate.test(oldHello));
        gate.rotate(next);
        assertFalse(gate.test(oldHello));
        assertTrue(gate.test(nextHello));
        assertFalse(gate.test(nextHello.replace("room-1", "room-2")));
    }
}
