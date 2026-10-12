package com.galerows.app;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import java.security.KeyStore;
import javax.crypto.KeyGenerator;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class LanSecureChannelTest {
    private static final String HELLO = "{\"kind\":\"hello\",\"inviteToken\":\"test-secret\"}";

    @Test public void pinnedCertificateAllowsWebSocketAndWrongPinSendsNoHello() throws Exception {
        LinkedBlockingQueue<LanSocketServer.Event> events = new LinkedBlockingQueue<>();
        LinkedBlockingQueue<String> guestMessages = new LinkedBlockingQueue<>();
        LinkedBlockingQueue<String> guestStatuses = new LinkedBlockingQueue<>();
        try (LanTlsIdentity identity = LanTlsIdentity.createEphemeral()) {
            LanSocketServer server = new LanSocketServer(HELLO::equals, events::add, identity.serverSocketFactory());
            try {
                server.start(0);
                String wrongPin = "00".repeat(32);
                try {
                    LanSecureClient.connect("127.0.0.1", server.port(), wrongPin, HELLO, event -> { });
                    fail("Incorrect host identity must be rejected");
                } catch (LanSecureClient.HostIdentityException expected) { }
                assertNull("Failed TLS verification must never deliver hello", events.poll(250, TimeUnit.MILLISECONDS));

                try (LanSecureClient client = LanSecureClient.connect(
                    "127.0.0.1", server.port(), identity.fingerprint(), HELLO, guestMessages::add, guestStatuses::add)) {
                    assertEquals("socket_connected", guestStatuses.poll(5, TimeUnit.SECONDS));
                    assertTrue(client.tlsProtocol().startsWith("TLSv1."));
                    assertFalse(client.tlsCipherSuite().contains("NULL"));
                    LanSocketServer.Event connected = events.poll(5, TimeUnit.SECONDS);
                    assertNotNull("Expected authenticated WebSocket peer", connected);
                    assertEquals("connected", connected.type);
                    client.send("from-guest");
                    LanSocketServer.Event message = events.poll(5, TimeUnit.SECONDS);
                    assertNotNull(message);
                    assertEquals("message", message.type);
                    assertEquals("from-guest", message.data);
                    server.send(connected.peerId, "from-host");
                    assertEquals("from-host", guestMessages.poll(5, TimeUnit.SECONDS));
                }
                assertEquals("disconnected", events.poll(5, TimeUnit.SECONDS).type);
                try (LanSecureClient reconnected = LanSecureClient.connect(
                    "127.0.0.1", server.port(), identity.fingerprint(), HELLO, guestMessages::add)) {
                    assertEquals("connected", events.poll(5, TimeUnit.SECONDS).type);
                }
            } finally { server.stop(); }
        }
    }

    @Test public void newIdentityRemovesAbandonedKeystoreAliases() throws Exception {
        String orphan = "galerows-lan-orphan-test";
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        KeyGenerator generator = KeyGenerator.getInstance("AES", "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(orphan,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .build());
        generator.generateKey();
        assertTrue(store.containsAlias(orphan));
        try (LanTlsIdentity ignored = LanTlsIdentity.createEphemeral()) {
            assertFalse("An abandoned LAN key should be removed at next host start", store.containsAlias(orphan));
        } finally { store.deleteEntry(orphan); }
    }
}
