package com.galerows.app;

import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import java.math.BigInteger;
import java.net.Socket;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.security.PrivateKey;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import java.security.spec.ECGenParameterSpec;
import java.util.Date;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import javax.net.ServerSocketFactory;
import javax.net.ssl.KeyManager;
import javax.net.ssl.SSLContext;
import javax.net.ssl.X509ExtendedKeyManager;
import javax.security.auth.x500.X500Principal;

/** A per-host-session Android Keystore key and self-signed TLS certificate. */
final class LanTlsIdentity implements AutoCloseable {
    private static final String PREFIX = "galerows-lan-";
    private static final Set<String> ACTIVE_ALIASES = new HashSet<>();
    private final KeyStore keyStore;
    private final String alias;
    private final X509Certificate certificate;
    private final SSLContext context;

    private LanTlsIdentity(KeyStore keyStore, String alias, X509Certificate certificate, SSLContext context) {
        this.keyStore = keyStore;
        this.alias = alias;
        this.certificate = certificate;
        this.context = context;
    }

    static synchronized LanTlsIdentity createEphemeral() throws Exception {
        String alias = PREFIX + UUID.randomUUID();
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        java.util.Enumeration<String> aliases = store.aliases();
        while (aliases.hasMoreElements()) {
            String old = aliases.nextElement();
            if (old.startsWith(PREFIX) && !ACTIVE_ALIASES.contains(old)) store.deleteEntry(old);
        }
        long now = System.currentTimeMillis();
        KeyPairGenerator generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore");
        generator.initialize(new KeyGenParameterSpec.Builder(alias,
            KeyProperties.PURPOSE_SIGN | KeyProperties.PURPOSE_VERIFY)
            .setAlgorithmParameterSpec(new ECGenParameterSpec("secp256r1"))
            .setDigests(KeyProperties.DIGEST_NONE, KeyProperties.DIGEST_SHA256)
            .setCertificateSubject(new X500Principal("CN=Galerows LAN session"))
            .setCertificateSerialNumber(new BigInteger(64, new SecureRandom()).abs())
            .setCertificateNotBefore(new Date(now - 60_000))
            .setCertificateNotAfter(new Date(now + 24L * 60 * 60 * 1000))
            .build());
        try {
            generator.generateKeyPair();
            X509Certificate certificate = (X509Certificate) store.getCertificate(alias);
            certificate.checkValidity();
            certificate.verify(certificate.getPublicKey());
            PrivateKey key = (PrivateKey) store.getKey(alias, null);
            SSLContext context = SSLContext.getInstance("TLS");
            context.init(new KeyManager[]{new SessionKeyManager(alias, key, certificate)}, null, new SecureRandom());
            ACTIVE_ALIASES.add(alias);
            return new LanTlsIdentity(store, alias, certificate, context);
        } catch (Exception error) {
            store.deleteEntry(alias);
            throw error;
        }
    }

    ServerSocketFactory serverSocketFactory() { return context.getServerSocketFactory(); }

    String fingerprint() throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(certificate.getEncoded());
        StringBuilder hex = new StringBuilder(digest.length * 2);
        for (byte value : digest) hex.append(String.format(java.util.Locale.ROOT, "%02x", value & 0xff));
        return hex.toString();
    }

    @Override public void close() throws Exception {
        synchronized (LanTlsIdentity.class) {
            try { keyStore.deleteEntry(alias); }
            finally { ACTIVE_ALIASES.remove(alias); }
        }
    }

    private static final class SessionKeyManager extends X509ExtendedKeyManager {
        private final String alias;
        private final PrivateKey key;
        private final X509Certificate[] chain;
        SessionKeyManager(String alias, PrivateKey key, X509Certificate certificate) {
            this.alias = alias;
            this.key = key;
            this.chain = new X509Certificate[]{certificate};
        }
        @Override public String[] getClientAliases(String keyType, java.security.Principal[] issuers) { return null; }
        @Override public String chooseClientAlias(String[] keyTypes, java.security.Principal[] issuers, Socket socket) { return null; }
        @Override public String[] getServerAliases(String keyType, java.security.Principal[] issuers) {
            return "EC".equals(keyType) ? new String[]{alias} : null;
        }
        @Override public String chooseServerAlias(String keyType, java.security.Principal[] issuers, Socket socket) {
            return "EC".equals(keyType) ? alias : null;
        }
        @Override public java.security.cert.X509Certificate[] getCertificateChain(String requestedAlias) {
            return alias.equals(requestedAlias) ? chain.clone() : null;
        }
        @Override public PrivateKey getPrivateKey(String requestedAlias) {
            return alias.equals(requestedAlias) ? key : null;
        }
    }
}
