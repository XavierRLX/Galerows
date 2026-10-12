package com.galerows.app;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;
import java.util.function.Predicate;
import javax.net.ServerSocketFactory;
import org.json.JSONObject;

/** Real LAN server extracted from Capacitor so JVM integration exercises the same sockets. */
final class LanSocketServer {
    private static final int MAX_BYTES = 16 * 1024;
    private static final int MAX_PEERS = 16;
    private static final int MAX_HEADERS = 8192;

    static final class Event {
        final String type;
        final String peerId;
        final String data;
        Event(String type, String peerId, String data) {
            this.type = type;
            this.peerId = peerId;
            this.data = data;
        }
    }

    private final Predicate<String> authenticateHello;
    private final Consumer<Event> onEvent;
    private final ServerSocketFactory socketFactory;
    private final ConcurrentHashMap<String, Socket> peers = new ConcurrentHashMap<>();
    private final Set<Socket> pending = ConcurrentHashMap.newKeySet();
    private volatile ServerSocket listenerSocket;
    private volatile boolean running;

    LanSocketServer(Predicate<String> authenticateHello, Consumer<Event> onEvent) {
        this(authenticateHello, onEvent, ServerSocketFactory.getDefault());
    }

    LanSocketServer(Predicate<String> authenticateHello, Consumer<Event> onEvent, ServerSocketFactory socketFactory) {
        this.authenticateHello = authenticateHello;
        this.onEvent = onEvent;
        this.socketFactory = socketFactory;
    }

    synchronized int start(int port) throws IOException {
        if (running) throw new IOException("already_running");
        ServerSocket listening = socketFactory.createServerSocket();
        listening.bind(new InetSocketAddress(port));
        listenerSocket = listening;
        running = true;
        Thread thread = new Thread(() -> acceptLoop(listening), "galerows-lan-accept");
        thread.setDaemon(true);
        thread.start();
        return listening.getLocalPort();
    }

    int port() {
        ServerSocket current = listenerSocket;
        if (current == null || current.isClosed()) throw new IllegalStateException("not_running");
        return current.getLocalPort();
    }

    boolean isRunning() { return running; }

    void send(String peerId, String message) throws IOException {
        byte[] data = message.getBytes(StandardCharsets.UTF_8);
        if (data.length > MAX_BYTES) throw new IOException("frame_too_large");
        Socket socket = running ? peers.get(peerId) : null;
        if (socket == null || socket.isClosed()) throw new IOException("peer_not_found");
        synchronized (socket) {
            LanWebSocketCodec.write(socket.getOutputStream(), 1, data);
        }
    }

    void closePeer(String peerId) throws IOException {
        Socket socket = peers.remove(peerId);
        if (socket == null) throw new IOException("peer_not_found");
        closeQuietly(socket);
        emit("disconnected", peerId, null);
    }

    synchronized void stop() {
        running = false;
        ServerSocket current = listenerSocket;
        listenerSocket = null;
        closeQuietly(current);
        for (Socket socket : pending) closeQuietly(socket);
        pending.clear();
        for (Map.Entry<String, Socket> entry : peers.entrySet()) {
            if (peers.remove(entry.getKey(), entry.getValue())) {
                closeQuietly(entry.getValue());
                emit("disconnected", entry.getKey(), null);
            }
        }
    }

    private void acceptLoop(ServerSocket listening) {
        while (running && !listening.isClosed()) {
            try {
                Socket connection = listening.accept();
                connection.setSoTimeout(15000);
                if (!running || pending.size() + peers.size() >= MAX_PEERS) {
                    closeQuietly(connection);
                    continue;
                }
                pending.add(connection);
                Thread thread = new Thread(() -> handle(connection), "galerows-lan-peer");
                thread.setDaemon(true);
                thread.start();
            } catch (IOException error) {
                if (!running || listening.isClosed()) break;
            }
        }
    }

    private void handle(Socket connection) {
        String peerId = UUID.randomUUID().toString();
        try (Socket socket = connection) {
            InputStream in = socket.getInputStream();
            OutputStream out = socket.getOutputStream();
            String request = readRequest(in);
            if (!LanWebSocketCodec.validUpgrade(request)) return;
            String key = LanWebSocketCodec.key(request);
            String accept = Base64.getEncoder().encodeToString(
                MessageDigest.getInstance("SHA-1").digest(
                    (key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").getBytes(StandardCharsets.US_ASCII)
                )
            );
            out.write(("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: "
                + accept + "\r\n\r\n").getBytes(StandardCharsets.US_ASCII));
            out.flush();

            boolean authenticated = false;
            ByteArrayOutputStream fragments = null;
            while (running && !socket.isClosed()) {
                LanWebSocketCodec.Frame frame = LanWebSocketCodec.read(in);
                if (frame == null) break;
                if (frame.opcode == 8) {
                    if (frame.payload.length == 1) break;
                    synchronized (socket) { LanWebSocketCodec.write(out, 8, frame.payload); }
                    break;
                }
                if (frame.opcode == 9) {
                    synchronized (socket) { LanWebSocketCodec.write(out, 10, frame.payload); }
                    continue;
                }
                if (frame.opcode == 10) continue;
                if (frame.opcode == 1) {
                    if (fragments != null) break;
                    fragments = new ByteArrayOutputStream();
                } else if (frame.opcode == 0) {
                    if (fragments == null) break;
                } else break;
                if (fragments.size() + frame.payload.length > MAX_BYTES) break;
                fragments.write(frame.payload);
                if (!frame.fin) continue;
                String message = LanWebSocketCodec.utf8(fragments.toByteArray());
                fragments = null;
                if (!authenticated) {
                    if (!authenticateHello.test(message)) break;
                    synchronized (this) {
                        if (!running) break;
                        peers.put(peerId, socket);
                        pending.remove(socket);
                    }
                    authenticated = true;
                    emit("connected", peerId, null);
                    if ("resumeHello".equals(new JSONObject(message).optString("kind")))
                        emit("message", peerId, message);
                    socket.setSoTimeout(0);
                } else {
                    emit("message", peerId, message);
                }
            }
        } catch (Exception ignored) {
            // Malformed or disconnected peers must not terminate the listener.
        } finally {
            pending.remove(connection);
            if (peers.remove(peerId, connection)) emit("disconnected", peerId, null);
        }
    }

    private static String readRequest(InputStream in) throws IOException {
        ByteArrayOutputStream request = new ByteArrayOutputStream();
        int b;
        while (request.size() < MAX_HEADERS && (b = in.read()) != -1) {
            request.write(b);
            byte[] bytes = request.toByteArray();
            int n = bytes.length;
            if (n >= 4 && bytes[n - 4] == 13 && bytes[n - 3] == 10 && bytes[n - 2] == 13 && bytes[n - 1] == 10) {
                return request.toString("US-ASCII");
            }
        }
        throw new IOException("invalid_handshake");
    }

    private void emit(String type, String peerId, String data) {
        onEvent.accept(new Event(type, peerId, data));
    }

    private static void closeQuietly(ServerSocket socket) {
        if (socket != null) try { socket.close(); } catch (IOException ignored) { }
    }
    private static void closeQuietly(Socket socket) {
        if (socket != null) try { socket.close(); } catch (IOException ignored) { }
    }
}
