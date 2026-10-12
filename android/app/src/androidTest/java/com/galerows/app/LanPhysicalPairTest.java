package com.galerows.app;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import static org.junit.Assert.*;
import static org.junit.Assume.assumeTrue;

/** Two-device native WSS probe. Its hello value exists only in androidTest APKs. */
@RunWith(AndroidJUnit4.class)
public class LanPhysicalPairTest {
    private static final String HELLO = "{\"kind\":\"hello\",\"protocolVersion\":1,\"roomId\":\"instrumented-room\",\"inviteToken\":\"instrumented-test-only-token\"}";
    private static final String PING = "{\"kind\":\"ping\",\"protocolVersion\":1}";
    private static final String PONG = "{\"kind\":\"pong\",\"protocolVersion\":1}";

    @Test public void host() throws Exception {
        assumeTrue("host".equals(InstrumentationRegistry.getArguments().getString("pairMode")));
        LinkedBlockingQueue<LanSocketServer.Event> events = new LinkedBlockingQueue<>();
        File ready = new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getFilesDir(), "lan-host-ready.txt");
        try (LanTlsIdentity identity = LanTlsIdentity.createEphemeral()) {
            LanSocketServer server = new LanSocketServer(HELLO::equals, events::add, identity.serverSocketFactory());
            try {
                int port = server.start(0);
                try (FileOutputStream out = new FileOutputStream(ready)) {
                    out.write((port + "\n" + identity.fingerprint()).getBytes(StandardCharsets.US_ASCII));
                }
                for (int i = 0; i < 2; i++) {
                    LanSocketServer.Event connected = events.poll(60, TimeUnit.SECONDS);
                    assertNotNull("No peer connected", connected);
                    assertEquals("connected", connected.type);
                    LanSocketServer.Event message = events.poll(10, TimeUnit.SECONDS);
                    assertNotNull("No client message", message);
                    assertEquals("message", message.type);
                    assertEquals(PONG, message.data);
                    server.send(connected.peerId, PING);
                    LanSocketServer.Event disconnected = events.poll(10, TimeUnit.SECONDS);
                    assertNotNull("Peer did not disconnect", disconnected);
                    assertEquals("disconnected", disconnected.type);
                }
            } finally { ready.delete(); server.stop(); }
        }
    }

    @Test public void guest() throws Exception {
        android.os.Bundle args = InstrumentationRegistry.getArguments();
        assumeTrue("guest".equals(args.getString("pairMode")));
        String host = args.getString("host");
        int port = Integer.parseInt(args.getString("port", "0"));
        String fingerprint = args.getString("fingerprint");
        assertNotNull(host);
        assertNotNull(fingerprint);
        String wrong = (fingerprint.charAt(0) == '0' ? '1' : '0') + fingerprint.substring(1);
        try {
            LanSecureClient.connect(host, port, wrong, HELLO, message -> { });
            fail("Wrong host identity accepted");
        } catch (LanSecureClient.HostIdentityException expected) { }
        LinkedBlockingQueue<String> messages = new LinkedBlockingQueue<>();
        for (int i = 0; i < 2; i++) {
            try (LanSecureClient client = LanSecureClient.connect(host, port, fingerprint, HELLO, messages::add)) {
                assertTrue(client.tlsProtocol().equals("TLSv1.2") || client.tlsProtocol().equals("TLSv1.3"));
                assertFalse(client.tlsCipherSuite().contains("NULL"));
                client.send(PONG);
                assertEquals(PING, messages.poll(10, TimeUnit.SECONDS));
            }
        }
    }
}
