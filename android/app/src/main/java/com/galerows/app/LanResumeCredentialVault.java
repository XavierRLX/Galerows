package com.galerows.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONObject;

/** Stores only AES-GCM ciphertext; the non-exportable key lives in Android Keystore. */
final class LanResumeCredentialVault {
    private static final String KEY_ALIAS = "galerows.lan.resume.v1";
    private static final String PREFS = "galerows_lan_resume_v1";
    private static final long MAX_RESUME_LIFETIME_MS = 24L * 60 * 60 * 1000;
    private final SharedPreferences prefs;

    LanResumeCredentialVault(Context context) {
        prefs = context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static void validate(String roomId, String playerId, String token, long expiresAt,
                         String host, int port, String fingerprint) {
        long now = System.currentTimeMillis();
        if (roomId == null || roomId.isEmpty() || roomId.length() > 256
            || !LanHelloAuthenticator.validPlayerId(playerId)
            || !LanHelloAuthenticator.validToken(token)
            || expiresAt <= now || expiresAt - now > MAX_RESUME_LIFETIME_MS
            || host == null || !host.matches("[a-zA-Z0-9.:-]+")
            || port < 1 || port > 65535
            || fingerprint == null || !fingerprint.matches("(?i)[0-9a-f]{64}"))
            throw new IllegalArgumentException("invalid_resume_credential");
    }

    static int credentialProtocolVersion(JSONObject credential) {
        if (credential == null) throw new IllegalArgumentException("invalid_resume_credential");
        Object raw = credential.opt("protocolVersion");
        if (raw == null || raw == JSONObject.NULL) {
            if (credential.has("protocolVersion")) throw new IllegalArgumentException("incompatible_protocol");
            return 1; // Credentials persisted by the deployed LAN v1 do not have a version field.
        }
        if (!(raw instanceof Integer) && !(raw instanceof Long))
            throw new IllegalArgumentException("incompatible_protocol");
        int version = ((Number) raw).intValue();
        if ((version != 1 && version != 2) || ((Number) raw).longValue() != version)
            throw new IllegalArgumentException("incompatible_protocol");
        return version;
    }

    static void validate(String roomId, String playerId, String token, long expiresAt,
                         String host, int port, String fingerprint, int protocolVersion) {
        if (protocolVersion != 1 && protocolVersion != 2)
            throw new IllegalArgumentException("incompatible_protocol");
        validate(roomId, playerId, token, expiresAt, host, port, fingerprint);
    }

    void store(String roomId, String playerId, String token, long expiresAt,
                            String host, int port, String fingerprint) throws Exception {
        store(roomId, playerId, token, expiresAt, host, port, fingerprint, 1);
    }

    void store(String roomId, String playerId, String token, long expiresAt,
                            String host, int port, String fingerprint, int protocolVersion) throws Exception {
        synchronized (LanResumeCredentialVault.class) {
        validate(roomId, playerId, token, expiresAt, host, port, fingerprint, protocolVersion);
        JSONObject json = new JSONObject();
        json.put("roomId", roomId);
        json.put("playerId", playerId);
        json.put("resumeToken", token);
        json.put("expiresAt", expiresAt);
        json.put("host", host);
        json.put("port", port);
        json.put("fingerprint", fingerprint);
        json.put("protocolVersion", protocolVersion);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key());
        cipher.updateAAD(roomId.getBytes(StandardCharsets.UTF_8));
        byte[] ciphertext = cipher.doFinal(json.toString().getBytes(StandardCharsets.UTF_8));
        byte[] packed = new byte[cipher.getIV().length + ciphertext.length];
        System.arraycopy(cipher.getIV(), 0, packed, 0, cipher.getIV().length);
        System.arraycopy(ciphertext, 0, packed, cipher.getIV().length, ciphertext.length);
        if (!prefs.edit().putString(preferenceKey(roomId), Base64.getEncoder().encodeToString(packed)).commit())
            throw new IllegalStateException("resume_vault_write_failed");
        }
    }

    JSONObject load(String roomId) throws Exception {
        synchronized (LanResumeCredentialVault.class) {
        if (roomId == null || roomId.isEmpty()) throw new IllegalArgumentException("invalid_room");
        String stored = prefs.getString(preferenceKey(roomId), null);
        if (stored == null) throw new IllegalArgumentException("resume_credential_not_found");
        try {
            byte[] packed = Base64.getDecoder().decode(stored);
            if (packed.length < 29) throw new IllegalArgumentException("invalid_resume_credential");
            byte[] iv = new byte[12];
            System.arraycopy(packed, 0, iv, 0, 12);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, iv));
            cipher.updateAAD(roomId.getBytes(StandardCharsets.UTF_8));
            JSONObject json = new JSONObject(new String(cipher.doFinal(packed, 12, packed.length - 12), StandardCharsets.UTF_8));
            validate(roomId, json.getString("playerId"), json.getString("resumeToken"), json.getLong("expiresAt"),
                json.getString("host"), json.getInt("port"), json.getString("fingerprint"),
                credentialProtocolVersion(json));
            if (!roomId.equals(json.getString("roomId"))) throw new IllegalArgumentException("invalid_room");
            return json;
        } catch (Exception error) {
            clear(roomId);
            throw error;
        }
        }
    }

    void clear(String roomId) throws Exception {
        synchronized (LanResumeCredentialVault.class) {
        if (roomId == null || roomId.isEmpty()) throw new IllegalArgumentException("invalid_room");
        if (!prefs.edit().remove(preferenceKey(roomId)).commit())
            throw new IllegalStateException("resume_vault_clear_failed");
        }
    }

    void rotate(String roomId, String playerId, String nextToken, long expiresAt) throws Exception {
        synchronized (LanResumeCredentialVault.class) {
            JSONObject next = rotatedCredential(load(roomId), roomId, playerId, nextToken, expiresAt);
            store(roomId, playerId, nextToken, expiresAt, next.getString("host"), next.getInt("port"),
                next.getString("fingerprint"), credentialProtocolVersion(next));
        }
    }

    static JSONObject rotatedCredential(JSONObject stored, String roomId, String playerId,
                                        String nextToken, long expiresAt) throws Exception {
        if (stored == null || !stored.getString("roomId").equals(roomId)
            || !stored.getString("playerId").equals(playerId))
            throw new IllegalArgumentException("resume_player_mismatch");
        String host = stored.getString("host");
        int port = stored.getInt("port");
        String fingerprint = stored.getString("fingerprint");
        int protocolVersion = credentialProtocolVersion(stored);
        validate(roomId, playerId, nextToken, expiresAt, host, port, fingerprint, protocolVersion);
        return new JSONObject()
            .put("roomId", roomId).put("playerId", playerId)
            .put("resumeToken", nextToken).put("expiresAt", expiresAt)
            .put("host", host).put("port", port).put("fingerprint", fingerprint)
            .put("protocolVersion", protocolVersion);
    }

    private static String preferenceKey(String roomId) throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(roomId.getBytes(StandardCharsets.UTF_8));
        return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
    }

    private static SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        SecretKey existing = (SecretKey) store.getKey(KEY_ALIAS, null);
        if (existing != null) return existing;
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256).build());
        return generator.generateKey();
    }
}
