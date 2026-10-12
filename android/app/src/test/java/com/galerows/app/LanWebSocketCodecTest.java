package com.galerows.app;

import org.junit.Test;
import static org.junit.Assert.*;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;

public class LanWebSocketCodecTest {
    private byte[] frame(int opcode, boolean fin, boolean masked, byte[] data) {
        byte[] mask = {1, 2, 3, 4};
        byte[] bytes = new byte[2 + (masked ? 4 : 0) + data.length];
        bytes[0] = (byte) (opcode | (fin ? 128 : 0));
        bytes[1] = (byte) (data.length | (masked ? 128 : 0));
        int pos = 2;
        if (masked) { System.arraycopy(mask, 0, bytes, pos, 4); pos += 4; }
        for (int i = 0; i < data.length; i++) bytes[pos + i] = (byte) (data[i] ^ (masked ? mask[i % 4] : 0));
        return bytes;
    }
    @Test public void acceptsMaskedText() throws Exception {
        LanWebSocketCodec.Frame f = LanWebSocketCodec.read(new ByteArrayInputStream(frame(1, true, true, "ok".getBytes(StandardCharsets.UTF_8))));
        assertEquals(1, f.opcode);
        assertEquals("ok", new String(f.payload, StandardCharsets.UTF_8));
    }
    @Test public void rejectsUnmaskedClientFrame() throws Exception {
        assertThrows(Exception.class, () -> LanWebSocketCodec.read(new ByteArrayInputStream(frame(1, true, false, new byte[]{1}))));
    }
    @Test public void rejectsFragmentedControlFrame() throws Exception {
        assertThrows(Exception.class, () -> LanWebSocketCodec.read(new ByteArrayInputStream(frame(9, false, true, new byte[]{1}))));
    }
    @Test public void acceptsFragmentedDataFrame() throws Exception {
        assertFalse(LanWebSocketCodec.read(new ByteArrayInputStream(frame(1, false, true, new byte[]{1}))).fin);
    }
    @Test public void rejectsReservedCloseCode() throws Exception {
        byte[] invalidClose = {3, (byte) 237}; // close code 1005 cannot appear on the wire
        assertThrows(java.io.IOException.class,
            () -> LanWebSocketCodec.read(new ByteArrayInputStream(frame(8, true, true, invalidClose))));
    }
    @Test public void validatesUpgradeRequest() throws Exception {
        assertFalse(LanWebSocketCodec.validUpgrade("GET / HTTP/1.1\r\nUpgrade: websocket\r\n\r\n"));
        assertTrue(LanWebSocketCodec.validUpgrade("GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n"));
    }
}
