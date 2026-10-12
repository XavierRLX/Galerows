package com.galerows.app;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.security.cert.CertificateException;
import java.security.cert.X509Certificate;
import java.util.Base64;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSocket;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

/** Native WSS peer: pinned TLS handshake always precedes WebSocket upgrade and hello. */
final class LanSecureClient implements AutoCloseable {
    static final class HostIdentityException extends IOException {
        HostIdentityException(Throwable cause) { super("host_identity_mismatch", cause); }
    }

    private final SSLSocket socket;
    private final Consumer<String> onMessage;
    private final Consumer<String> onStatus;

    private LanSecureClient(SSLSocket socket, Consumer<String> onMessage, Consumer<String> onStatus) {
        this.socket = socket;
        this.onMessage = onMessage;
        this.onStatus = onStatus;
    }

    static LanSecureClient connect(String host, int port, String fingerprint, String hello,
                                   Consumer<String> onMessage) throws Exception {
        return connect(host, port, fingerprint, hello, onMessage, status -> { });
    }

    static LanSecureClient connect(String host, int port, String fingerprint, String hello,
                                   Consumer<String> onMessage, Consumer<String> onStatus) throws Exception {
        if (host == null || !host.matches("[a-zA-Z0-9.:-]+") || port < 1 || port > 65535
            || fingerprint == null || !fingerprint.matches("(?i)[0-9a-f]{64}")) {
            throw new IllegalArgumentException("invalid_secure_endpoint");
        }
        byte[] expected = hexBytes(fingerprint);
        AtomicBoolean mismatched = new AtomicBoolean();
        X509TrustManager pinTrust = new X509TrustManager() {
            @Override public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
            @Override public void checkClientTrusted(X509Certificate[] chain, String authType) throws CertificateException {
                throw new CertificateException("client_certificate_not_supported");
            }
            @Override public void checkServerTrusted(X509Certificate[] chain, String authType) throws CertificateException {
                try {
                    if (chain == null || chain.length != 1) throw new CertificateException("invalid_host_chain");
                    chain[0].checkValidity();
                    chain[0].verify(chain[0].getPublicKey());
                    byte[] actual = MessageDigest.getInstance("SHA-256").digest(chain[0].getEncoded());
                    if (!MessageDigest.isEqual(expected, actual)) {
                        mismatched.set(true);
                        throw new CertificateException("host_identity_mismatch");
                    }
                } catch (CertificateException error) { throw error; }
                  catch (Exception error) { throw new CertificateException("invalid_host_certificate", error); }
            }
        };
        SSLContext context = SSLContext.getInstance("TLS");
        context.init(null, new TrustManager[]{pinTrust}, new SecureRandom());
        SSLSocket socket = (SSLSocket) context.getSocketFactory().createSocket();
        try {
            socket.connect(new java.net.InetSocketAddress(host, port), 5000);
            onStatus.accept("socket_connected");
            socket.setSoTimeout(5000);
            try { socket.startHandshake(); }
            catch (IOException failure) {
                if (mismatched.get()) throw new HostIdentityException(failure);
                throw failure;
            }
            performUpgrade(socket, host, port);
            LanSecureClient client = new LanSecureClient(socket, onMessage, onStatus);
            client.send(hello);
            socket.setSoTimeout(0);
            client.readInBackground();
            return client;
        } catch (Exception error) {
            try { socket.close(); } catch (IOException ignored) { }
            throw error;
        }
    }

    synchronized void send(String message) throws IOException {
        byte[] payload = message.getBytes(StandardCharsets.UTF_8);
        if (payload.length > LanWebSocketCodec.MAX_BYTES) throw new IOException("frame_too_large");
        writeMasked(socket.getOutputStream(), 1, payload);
    }

    private void readInBackground() {
        Thread reader = new Thread(() -> {
            try {
                InputStream in = socket.getInputStream();
                while (!socket.isClosed()) {
                    int first = in.read();
                    if (first < 0) break;
                    int second = in.read();
                    if (second < 0 || (first & 0x70) != 0 || (second & 0x80) != 0) break;
                    int opcode = first & 15;
                    int length = second & 127;
                    if (length == 126) {
                        int high = in.read(), low = in.read();
                        if (high < 0 || low < 0) break;
                        length = (high << 8) | low;
                    } else if (length == 127) break;
                    if (length > LanWebSocketCodec.MAX_BYTES) break;
                    byte[] payload = LanWebSocketCodec.readExact(in, length);
                    if (opcode == 8) break;
                    if (opcode == 9) { synchronized (this) { writeMasked(socket.getOutputStream(), 10, payload); } continue; }
                    if (opcode == 1 && (first & 0x80) != 0) onMessage.accept(LanWebSocketCodec.utf8(payload));
                    else if (opcode != 10) break;
                }
            } catch (Exception ignored) {
                // Status is reported without logging payloads or credentials.
            } finally {
                try { socket.close(); } catch (IOException ignored) { }
                onStatus.accept("closed");
            }
        }, "galerows-lan-secure-client");
        reader.setDaemon(true);
        reader.start();
    }

    @Override public void close() throws IOException { socket.close(); }

    boolean isClosed() { return socket.isClosed(); }

    String tlsProtocol() { return socket.getSession().getProtocol(); }

    String tlsCipherSuite() { return socket.getSession().getCipherSuite(); }

    private static void performUpgrade(SSLSocket socket, String host, int port) throws Exception {
        byte[] nonce = new byte[16];
        new SecureRandom().nextBytes(nonce);
        String key = Base64.getEncoder().encodeToString(nonce);
        OutputStream out = socket.getOutputStream();
        out.write(("GET / HTTP/1.1\r\nHost: " + host + ":" + port
            + "\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: "
            + key + "\r\n\r\n").getBytes(StandardCharsets.US_ASCII));
        out.flush();
        ByteArrayOutputStream response = new ByteArrayOutputStream();
        InputStream in = socket.getInputStream();
        int b;
        while (response.size() < 8192 && (b = in.read()) >= 0) {
            response.write(b);
            byte[] bytes = response.toByteArray();
            int n = bytes.length;
            if (n >= 4 && bytes[n-4] == 13 && bytes[n-3] == 10 && bytes[n-2] == 13 && bytes[n-1] == 10) break;
        }
        String headers = response.toString("US-ASCII");
        String accept = Base64.getEncoder().encodeToString(MessageDigest.getInstance("SHA-1").digest(
            (key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").getBytes(StandardCharsets.US_ASCII)));
        if (!headers.startsWith("HTTP/1.1 101 ")
            || !headers.toLowerCase(Locale.ROOT).contains("upgrade: websocket\r\n")
            || !headers.toLowerCase(Locale.ROOT).contains("connection: upgrade\r\n")
            || !headers.contains("Sec-WebSocket-Accept: " + accept + "\r\n")) {
            throw new IOException("invalid_websocket_upgrade");
        }
    }

    private static void writeMasked(OutputStream out, int opcode, byte[] payload) throws IOException {
        if (payload.length > LanWebSocketCodec.MAX_BYTES) throw new IOException("frame_too_large");
        byte[] mask = new byte[4];
        new SecureRandom().nextBytes(mask);
        out.write(128 | opcode);
        if (payload.length < 126) out.write(128 | payload.length);
        else { out.write(128 | 126); out.write(payload.length >> 8); out.write(payload.length); }
        out.write(mask);
        for (int i = 0; i < payload.length; i++) out.write(payload[i] ^ mask[i % 4]);
        out.flush();
    }

    private static byte[] hexBytes(String hex) {
        byte[] result = new byte[hex.length() / 2];
        for (int i = 0; i < result.length; i++) result[i] = (byte) Integer.parseInt(hex.substring(i * 2, i * 2 + 2), 16);
        return result;
    }
}
