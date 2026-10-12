package com.galerows.app;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import static org.junit.Assert.*;
import static org.junit.Assume.assumeTrue;

/** Runs only when the physical host endpoint and session values are supplied at invocation. */
@RunWith(AndroidJUnit4.class)
public class LanPhysicalGuestTest {
    @Test public void pinnedHostRejectsWrongIdentityThenExchangesFramesAcrossLan() throws Exception {
        android.os.Bundle args = InstrumentationRegistry.getArguments();
        String host = args.getString("host");
        String fingerprint = args.getString("fingerprint");
        String roomId = args.getString("roomId");
        String token = args.getString("inviteToken");
        int port = Integer.parseInt(args.getString("port", "0"));
        assumeTrue(host != null && fingerprint != null && roomId != null && token != null && port > 0);
        String hello = new JSONObject().put("kind", "hello").put("protocolVersion", 1)
            .put("roomId", roomId).put("inviteToken", token).toString();
        String wrong = (fingerprint.charAt(0) == '0' ? '1' : '0') + fingerprint.substring(1);
        try {
            LanSecureClient.connect(host, port, wrong, hello, ignored -> { });
            fail("Wrong host certificate was accepted");
        } catch (LanSecureClient.HostIdentityException expected) { }

        LinkedBlockingQueue<String> messages = new LinkedBlockingQueue<>();
        try (LanSecureClient client = LanSecureClient.connect(host, port, fingerprint, hello, messages::add)) {
            assertTrue(client.tlsProtocol().startsWith("TLSv1."));
            assertFalse(client.tlsCipherSuite().contains("NULL"));
            client.send("{\"kind\":\"pong\",\"protocolVersion\":1}");
            assertEquals("{\"kind\":\"ping\",\"protocolVersion\":1}", messages.poll(30, TimeUnit.SECONDS));
        }
        try (LanSecureClient client = LanSecureClient.connect(host, port, fingerprint, hello, messages::add)) {
            client.send("{\"kind\":\"pong\",\"protocolVersion\":1}");
            assertEquals("{\"kind\":\"ping\",\"protocolVersion\":1}", messages.poll(30, TimeUnit.SECONDS));
        }
    }
}
