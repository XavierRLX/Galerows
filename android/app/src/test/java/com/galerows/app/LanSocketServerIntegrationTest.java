package com.galerows.app;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;

import java.io.ByteArrayOutputStream;
import java.io.EOFException;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Socket;
import java.net.SocketException;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import static org.junit.Assert.*;

public class LanSocketServerIntegrationTest {
    private static final String HELLO = "{\"kind\":\"hello\",\"protocolVersion\":1,\"roomId\":\"r\",\"inviteToken\":\"1234567890123456\"}";
    private final BlockingQueue<LanSocketServer.Event> events = new LinkedBlockingQueue<>();
    private LanSocketServer server;

    @Before public void setUp() throws Exception {
        server = new LanSocketServer(raw -> HELLO.equals(raw), events::add);
        server.start(0);
    }

    @After public void tearDown() {
        if (server != null) server.stop();
    }

    /** Real TCP / RFC 6455 peer. Does not mock any part of the production server. */
    private static class Client implements AutoCloseable {
        final Socket socket;
        final InputStream in;
        final OutputStream out;

        Client(int port) throws Exception {
            socket = new Socket("127.0.0.1", port);
            socket.setSoTimeout(3000);
            in = socket.getInputStream();
            out = socket.getOutputStream();
            String request = "GET / HTTP/1.1\r\nHost: localhost\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n";
            out.write(request.getBytes(StandardCharsets.US_ASCII));
            out.flush();
            ByteArrayOutputStream response = new ByteArrayOutputStream();
            int value;
            while ((value = in.read()) != -1) {
                response.write(value);
                if (response.size() >= 4 && response.toString("US-ASCII").endsWith("\r\n\r\n")) break;
                if (response.size() > 8192) throw new IOException("bad handshake response");
            }
            assertTrue(response.toString("US-ASCII"), response.toString("US-ASCII").startsWith("HTTP/1.1 101"));
            assertTrue(response.toString("US-ASCII").contains("Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo="));
        }

        void hello() throws IOException { send(1, HELLO.getBytes(StandardCharsets.UTF_8)); }
        void text(String text) throws IOException { send(1, text.getBytes(StandardCharsets.UTF_8)); }

        void send(int opcode, byte[] payload) throws IOException {
            sendPart(opcode, true, payload);
        }

        void sendPart(int opcode, boolean fin, byte[] payload) throws IOException {
            out.write((fin ? 0x80 : 0) | opcode);
            if (payload.length < 126) out.write(0x80 | payload.length);
            else { out.write(0x80 | 126); out.write(payload.length >>> 8); out.write(payload.length); }
            byte[] mask = { 7, 9, 11, 13 };
            out.write(mask);
            for (int i = 0; i < payload.length; i++) out.write(payload[i] ^ mask[i % 4]);
            out.flush();
        }

        int[] receiveHeader() throws IOException {
            int first = in.read();
            if (first < 0) throw new EOFException();
            int second = in.read();
            if (second < 0) throw new EOFException();
            assertEquals("server frames must be unmasked", 0, second & 0x80);
            return new int[]{first & 15, second & 127};
        }

        String receive(int expectedOpcode) throws IOException {
            int[] header = receiveHeader();
            assertEquals(expectedOpcode, header[0]);
            int length = header[1];
            if (length == 126) length = (in.read() << 8) | in.read();
            if (length > 8192) throw new IOException("oversized response");
            byte[] payload = new byte[length];
            int offset = 0;
            while (offset < length) {
                int n = in.read(payload, offset, length - offset);
                if (n < 0) throw new EOFException();
                offset += n;
            }
            return new String(payload, StandardCharsets.UTF_8);
        }

        @Override public void close() throws IOException { socket.close(); }
    }

    private static void assertConnectionClosed(InputStream in) throws IOException {
        try { assertEquals(-1, in.read()); }
        catch (SocketException resetIsAlsoClosure) { /* TCP RST for a peer sending invalid bytes. */ }
    }

    private LanSocketServer.Event take(String type) throws Exception {
        LanSocketServer.Event event = events.poll(3, TimeUnit.SECONDS);
        assertNotNull("Expected " + type + " event", event);
        assertEquals(type, event.type);
        return event;
    }

    @Test public void realHandshakeBidirectionalMessagingPingPongAndClose() throws Exception {
        try (Client client = new Client(server.port())) {
            client.hello();
            LanSocketServer.Event connected = take("connected");
            client.text("client-to-server");
            LanSocketServer.Event received = take("message");
            assertEquals(connected.peerId, received.peerId);
            assertEquals("client-to-server", received.data);
            server.send(connected.peerId, "server-to-client");
            assertEquals("server-to-client", client.receive(1));
            client.send(9, "alive".getBytes(StandardCharsets.UTF_8));
            assertEquals("alive", client.receive(10));
            client.send(8, new byte[]{3, (byte) 232}); // 1000
            client.receive(8);
            assertEquals(connected.peerId, take("disconnected").peerId);
        }
    }

    @Test public void authenticatedResumeHelloIsForwardedAndPeerCanBeClosed() throws Exception {
        server.stop();
        events.clear();
        String resume = "{\"kind\":\"resumeHello\",\"protocolVersion\":1,\"roomId\":\"r\",\"playerId\":\"p\",\"resumeToken\":\"token\"}";
        server = new LanSocketServer(resume::equals, events::add);
        server.start(0);
        try (Client rejected = new Client(server.port())) {
            rejected.text(resume.replace("token", "wrong"));
            assertConnectionClosed(rejected.in);
            assertNull(events.poll(100, TimeUnit.MILLISECONDS));
        }
        try (Client client = new Client(server.port())) {
            client.text(resume);
            LanSocketServer.Event connected = take("connected");
            LanSocketServer.Event forwarded = take("message");
            assertEquals(connected.peerId, forwarded.peerId);
            assertEquals(resume, forwarded.data);
            server.closePeer(connected.peerId);
            assertConnectionClosed(client.in);
            assertEquals(connected.peerId, take("disconnected").peerId);
        }
    }

    @Test public void versionTwoHelloAndResumeUseActualWebSocketWithoutV1Downgrade() throws Exception {
        server.stop();
        events.clear();
        String inviteToken = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        String resumeToken = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
        LanHelloAuthenticator gate = new LanHelloAuthenticator("r", inviteToken, 2);
        gate.registerResumeToken("guest", resumeToken, System.currentTimeMillis() + 60_000);
        server = new LanSocketServer(gate, events::add);
        server.start(0);
        String v1 = "{\"kind\":\"hello\",\"protocolVersion\":1,\"roomId\":\"r\",\"inviteToken\":\"" + inviteToken + "\"}";
        String v2 = v1.replace("\"protocolVersion\":1", "\"protocolVersion\":2");
        try (Client wrong = new Client(server.port())) {
            wrong.text(v1);
            assertConnectionClosed(wrong.in);
            assertNull(events.poll(100, TimeUnit.MILLISECONDS));
        }
        try (Client guest = new Client(server.port())) {
            guest.text(v2);
            LanSocketServer.Event connected = take("connected");
            guest.text("room-control");
            assertEquals(connected.peerId, take("message").peerId);
        }
        take("disconnected");
        String resume = "{\"kind\":\"resumeHello\",\"protocolVersion\":2,\"roomId\":\"r\",\"playerId\":\"guest\",\"resumeToken\":\"" + resumeToken + "\"}";
        try (Client recovered = new Client(server.port())) {
            recovered.text(resume);
            LanSocketServer.Event connected = take("connected");
            LanSocketServer.Event forwarded = take("message");
            assertEquals(connected.peerId, forwarded.peerId);
            assertEquals(resume, forwarded.data);
            server.closePeer(connected.peerId);
            assertConnectionClosed(recovered.in);
            assertEquals(connected.peerId, take("disconnected").peerId);
        }
    }

    @Test public void invalidInviteRejectedAndNextConnectionSucceeds() throws Exception {
        try (Client invalid = new Client(server.port())) {
            invalid.text("{\"kind\":\"hello\",\"inviteToken\":\"wrong\"}");
            assertEquals(-1, invalid.in.read());
            assertNull(events.poll(200, TimeUnit.MILLISECONDS));
        }
        try (Client valid = new Client(server.port())) {
            valid.hello();
            take("connected");
        }
        take("disconnected");
    }

    @Test public void simultaneousPeersAndReconnection() throws Exception {
        try (Client a = new Client(server.port()); Client b = new Client(server.port())) {
            a.hello(); b.hello();
            LanSocketServer.Event aConnected = take("connected");
            LanSocketServer.Event bConnected = take("connected");
            assertNotEquals(aConnected.peerId, bConnected.peerId);
            // Connections are accepted concurrently: their connected events may arrive in either order.
            a.text("identify-a");
            String aPeerId = take("message").peerId;
            assertTrue(aPeerId.equals(aConnected.peerId) || aPeerId.equals(bConnected.peerId));
            String bPeerId = aPeerId.equals(aConnected.peerId) ? bConnected.peerId : aConnected.peerId;
            server.send(aPeerId, "first");
            server.send(bPeerId, "second");
            assertEquals("first", a.receive(1));
            assertEquals("second", b.receive(1));
            a.close();
            assertEquals(aPeerId, take("disconnected").peerId);
            try (Client c = new Client(server.port())) {
                c.hello();
                assertNotEquals(aConnected.peerId, take("connected").peerId);
            }
        }
        take("disconnected"); take("disconnected");
    }

    @Test public void invalidUnmaskedFrameDoesNotKillAcceptLoop() throws Exception {
        try (Client invalid = new Client(server.port())) {
            invalid.out.write(new byte[]{(byte) 0x81, 0x01, 'x'});
            invalid.out.flush();
            assertConnectionClosed(invalid.in);
        }
        try (Client valid = new Client(server.port())) {
            valid.hello();
            take("connected");
        }
        take("disconnected");
    }

    @Test public void stopDisconnectsPeersAndRestartWorks() throws Exception {
        Client first = new Client(server.port());
        try {
            first.hello();
            LanSocketServer.Event peer = take("connected");
            server.stop();
            assertEquals(-1, first.in.read());
            try {
                server.send(peer.peerId, "after stop");
                fail("should refuse writes after stop");
            } catch (IOException expected) { }
            // stop closes the listener and peers, but a new start can allocate a new socket.
            assertEquals(peer.peerId, take("disconnected").peerId);
            server.start(0);
            try (Client reconnected = new Client(server.port())) {
                reconnected.hello();
                take("connected");
            }
            // A disconnected event from the old session may arrive before the new session.
        } finally { first.close(); }
    }

    @Test public void invalidLargePayloadIsDropped() throws Exception {
        try (Client client = new Client(server.port())) {
            client.hello();
            take("connected");
            // A masked 16385-byte frame is rejected from its header, before data allocation.
            client.out.write(new byte[]{(byte) 0x81, (byte) 0xFE, 0x40, 0x01});
            client.out.flush();
            assertConnectionClosed(client.in);
            take("disconnected");
        }
    }

    @Test public void fragmentedTextWithInterleavedControlFrame() throws Exception {
        try (Client client = new Client(server.port())) {
            client.hello();
            LanSocketServer.Event peer = take("connected");
            client.sendPart(1, false, "hello ".getBytes(StandardCharsets.UTF_8));
            client.send(9, "ping".getBytes(StandardCharsets.UTF_8));
            assertEquals("ping", client.receive(10));
            client.sendPart(0, true, "world".getBytes(StandardCharsets.UTF_8));
            LanSocketServer.Event message = take("message");
            assertEquals(peer.peerId, message.peerId);
            assertEquals("hello world", message.data);
        }
        take("disconnected");
    }

    @Test public void malformedHandshakeDoesNotReturnSwitchingProtocols() throws Exception {
        try (Socket invalid = new Socket("127.0.0.1", server.port())) {
            invalid.setSoTimeout(3000);
            invalid.getOutputStream().write(("GET /wrong HTTP/1.1\r\n"
                + "Host: localhost\r\n"
                + "Upgrade: websocket\r\n"
                + "Connection: Upgrade\r\n"
                + "Sec-WebSocket-Version: 13\r\n"
                + "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n")
                .getBytes(StandardCharsets.US_ASCII));
            assertConnectionClosed(invalid.getInputStream());
        }
        try (Client valid = new Client(server.port())) {
            valid.hello();
            take("connected");
        }
        take("disconnected");
    }

    @Test public void invalidUtf8FromAuthenticatedPeerIsDisconnected() throws Exception {
        try (Client client = new Client(server.port())) {
            client.hello();
            take("connected");
            client.send(1, new byte[]{(byte) 0xC3, (byte) 0x28});
            assertConnectionClosed(client.in);
            take("disconnected");
        }
    }
}
