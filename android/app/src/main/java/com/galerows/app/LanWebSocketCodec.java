package com.galerows.app;

import java.io.EOFException;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.StandardCharsets;
import java.nio.charset.CodingErrorAction;
import java.util.Base64;
import java.util.Locale;

/** Small RFC 6455 subset for client-to-server masked text/control frames. */
final class LanWebSocketCodec {
    static final int MAX_BYTES = 16 * 1024;
    static final class Frame {
        final int opcode;
        final boolean fin;
        final byte[] payload;
        Frame(int opcode, boolean fin, byte[] payload) { this.opcode = opcode; this.fin = fin; this.payload = payload; }
    }
    static Frame read(InputStream in) throws IOException {
        int first = in.read();
        if (first < 0) return null;
        int second = in.read();
        if (second < 0) throw new EOFException();
        int opcode = first & 15;
        boolean fin = (first & 128) != 0;
        if ((first & 0x70) != 0 || (second & 128) == 0 || !(opcode == 0 || opcode == 1 || opcode == 8 || opcode == 9 || opcode == 10)) throw new IOException("invalid_frame");
        long length = second & 127;
        if (length == 126) {
            int a = in.read(), b = in.read();
            if (a < 0 || b < 0) throw new EOFException();
            length = (a << 8) | b;
            if (length < 126) throw new IOException("non_minimal_length");
        } else if (length == 127) {
            long n = 0;
            for (int i = 0; i < 8; i++) { int b = in.read(); if (b < 0) throw new EOFException(); n = (n << 8) | b; }
            length = n;
            if (length < 65536) throw new IOException("non_minimal_length");
        }
        if (length < 0 || length > MAX_BYTES || (opcode >= 8 && (!fin || length > 125))) throw new IOException("invalid_frame_length");
        byte[] mask = readExact(in, 4);
        byte[] data = readExact(in, (int) length);
        for (int i = 0; i < data.length; i++) data[i] ^= mask[i % 4];
        if (opcode == 8 && data.length >= 2) {
            int code = ((data[0] & 255) << 8) | (data[1] & 255);
            boolean standard = code >= 1000 && code <= 1014 && code != 1004 && code != 1005 && code != 1006;
            boolean application = code >= 3000 && code <= 4999;
            if (!standard && !application) throw new IOException("invalid_close_code");
            utf8(java.util.Arrays.copyOfRange(data, 2, data.length));
        }
        return new Frame(opcode, fin, data);
    }
    static byte[] readExact(InputStream in, int length) throws IOException {
        byte[] data = new byte[length];
        int offset = 0;
        while (offset < length) { int n = in.read(data, offset, length - offset); if (n < 0) throw new EOFException(); if (n == 0) continue; offset += n; }
        return data;
    }
    static String utf8(byte[] data) throws CharacterCodingException {
        return StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(data)).toString();
    }
    static boolean validUpgrade(String request) {
        String[] lines = request.split("\r\n");
        if (lines.length < 5 || !"GET / HTTP/1.1".equals(lines[0])) return false;
        String key = null; boolean upgrade = false, connection = false, version = false, host = false;
        for (int i = 1; i < lines.length; i++) {
            int colon = lines[i].indexOf(':'); if (colon <= 0) continue;
            String name = lines[i].substring(0, colon).trim().toLowerCase(Locale.ROOT);
            String value = lines[i].substring(colon + 1).trim();
            if (name.equals("sec-websocket-key")) { if (key != null) return false; key = value; }
            if (name.equals("upgrade")) upgrade = value.equalsIgnoreCase("websocket");
            if (name.equals("connection")) for (String token : value.split(",")) if (token.trim().equalsIgnoreCase("upgrade")) connection = true;
            if (name.equals("sec-websocket-version")) version = value.equals("13");
            if (name.equals("host")) host = !value.isEmpty();
        }
        if (!upgrade || !connection || !version || !host || key == null) return false;
        try { return Base64.getDecoder().decode(key).length == 16; } catch (IllegalArgumentException error) { return false; }
    }
    static String key(String request) {
        for (String line : request.split("\r\n")) if (line.toLowerCase(Locale.ROOT).startsWith("sec-websocket-key:")) return line.substring(line.indexOf(':') + 1).trim();
        throw new IllegalArgumentException("missing_key");
    }
    static void write(OutputStream out, int opcode, byte[] payload) throws IOException {
        if (payload.length > MAX_BYTES) throw new IOException("frame_too_large");
        out.write(128 | opcode);
        if (payload.length < 126) out.write(payload.length);
        else { out.write(126); out.write(payload.length >> 8); out.write(payload.length); }
        out.write(payload); out.flush();
    }
}
