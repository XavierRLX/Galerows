package com.galerows.app;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayDeque;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Predicate;
import org.json.JSONObject;

/** The token gates a TLS socket only; room admission is a separate WebView decision. */
final class LanHelloAuthenticator implements Predicate<String> {
    private final String roomId;
    private final int protocolVersion;
    private final AtomicReference<String> token;
    private final AtomicReference<String> shortCodeToken = new AtomicReference<>(null);
    private final Map<String, ArrayDeque<ResumeToken>> resumeTokens = new HashMap<>();
    private static final int MAX_PLAYERS = 16;
    private static final long MAX_RESUME_LIFETIME_MS = 24L * 60 * 60 * 1000;

    private static final class ResumeToken {
        final byte[] value;
        final long expiresAt;
        ResumeToken(String value, long expiresAt) {
            this.value = value.getBytes(StandardCharsets.US_ASCII);
            this.expiresAt = expiresAt;
        }
    }

    LanHelloAuthenticator(String roomId, String initialToken) {
        this(roomId, initialToken, 1);
    }

    LanHelloAuthenticator(String roomId, String initialToken, int protocolVersion) {
        if (protocolVersion != 1 && protocolVersion != 2)
            throw new IllegalArgumentException("incompatible_protocol");
        this.roomId = roomId;
        this.protocolVersion = protocolVersion;
        this.token = new AtomicReference<>(initialToken);
    }

    String roomIdentifier() { return roomId; }
    int version() { return protocolVersion; }

    void rotate(String nextToken) {
        if (nextToken == null || !nextToken.matches("[0-9a-f]{64}")) throw new IllegalArgumentException("invalid_token");
        token.set(nextToken);
    }

    void enableShortCodeToken(String codeToken) {
        if (!validToken(codeToken) || protocolVersion != 2)
            throw new IllegalArgumentException("invalid_room_code_token");
        shortCodeToken.set(codeToken);
    }

    synchronized void registerResumeToken(String playerId, String resumeToken, long expiresAt) {
        long now = System.currentTimeMillis();
        if (!validPlayerId(playerId) || !validToken(resumeToken)
            || expiresAt <= now || expiresAt - now > MAX_RESUME_LIFETIME_MS)
            throw new IllegalArgumentException("invalid_resume_credential");
        purgeExpired();
        if (!resumeTokens.containsKey(playerId) && resumeTokens.size() >= MAX_PLAYERS)
            throw new IllegalArgumentException("resume_registry_full");
        ArrayDeque<ResumeToken> values = resumeTokens.computeIfAbsent(playerId, key -> new ArrayDeque<>());
        byte[] next = resumeToken.getBytes(StandardCharsets.US_ASCII);
        values.removeIf(existing -> MessageDigest.isEqual(existing.value, next));
        if (values.size() == 2) values.removeFirst();
        values.addLast(new ResumeToken(resumeToken, expiresAt));
    }

    synchronized void revokeResumeToken(String playerId, String resumeToken) {
        if (!validPlayerId(playerId) || !validToken(resumeToken))
            throw new IllegalArgumentException("invalid_resume_credential");
        ArrayDeque<ResumeToken> values = resumeTokens.get(playerId);
        if (values == null) return;
        byte[] revoked = resumeToken.getBytes(StandardCharsets.US_ASCII);
        values.removeIf(existing -> MessageDigest.isEqual(existing.value, revoked));
        if (values.isEmpty()) resumeTokens.remove(playerId);
    }

    private synchronized boolean resumeMatches(String playerId, String supplied) {
        if (!validPlayerId(playerId) || !validToken(supplied)) return false;
        purgeExpired();
        ArrayDeque<ResumeToken> values = resumeTokens.get(playerId);
        if (values == null) return false;
        byte[] bytes = supplied.getBytes(StandardCharsets.US_ASCII);
        int matched = 0;
        for (ResumeToken value : values) matched |= MessageDigest.isEqual(value.value, bytes) ? 1 : 0;
        return matched != 0;
    }

    private void purgeExpired() {
        long now = System.currentTimeMillis();
        Iterator<Map.Entry<String, ArrayDeque<ResumeToken>>> it = resumeTokens.entrySet().iterator();
        while (it.hasNext()) {
            ArrayDeque<ResumeToken> values = it.next().getValue();
            values.removeIf(value -> value.expiresAt <= now);
            if (values.isEmpty()) it.remove();
        }
    }

    static boolean validPlayerId(String value) {
        return value != null && value.matches("[a-zA-Z0-9_-]{1,128}");
    }

    static boolean validToken(String value) { return value != null && value.matches("[0-9a-f]{64}"); }

    @Override public boolean test(String raw) {
        try {
            JSONObject hello = new JSONObject(raw);
            if (hello.optInt("protocolVersion") != protocolVersion || !roomId.equals(hello.optString("roomId"))) return false;
            if ("resumeHello".equals(hello.optString("kind")))
                return resumeMatches(hello.optString("playerId"), hello.optString("resumeToken"));
            if (!"hello".equals(hello.optString("kind"))) return false;
            byte[] candidate = hello.optString("inviteToken").getBytes(StandardCharsets.UTF_8);
            String roomCodeCredential = shortCodeToken.get();
            return MessageDigest.isEqual(token.get().getBytes(StandardCharsets.UTF_8), candidate)
                || (roomCodeCredential != null
                && MessageDigest.isEqual(roomCodeCredential.getBytes(StandardCharsets.UTF_8), candidate));
        } catch (Exception ignored) { return false; }
    }
}
