package com.galerows.app;

import android.security.NetworkSecurityPolicy;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class LanSecureProbePolicyTest {
    @Test public void secureBuildHasNoCleartextExceptionOrMixedContentFlag() throws Exception {
        NetworkSecurityPolicy policy = NetworkSecurityPolicy.getInstance();
        assertFalse(policy.isCleartextTrafficPermitted("10.245.112.98"));
        assertFalse(policy.isCleartextTrafficPermitted("192.168.0.84"));
        assertFalse(policy.isCleartextTrafficPermitted("example.com"));
        assertFalse(LanServerPlugin.cleartextPocAllowed(
            InstrumentationRegistry.getInstrumentation().getTargetContext()));
        try (InputStream input = InstrumentationRegistry.getInstrumentation().getTargetContext()
            .getAssets().open("capacitor.config.json")) {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            byte[] buffer = new byte[1024];
            int count;
            while ((count = input.read(buffer)) != -1) bytes.write(buffer, 0, count);
            JSONObject config = new JSONObject(bytes.toString("UTF-8"));
            assertFalse(config.getJSONObject("android").getBoolean("allowMixedContent"));
        }
    }
}
