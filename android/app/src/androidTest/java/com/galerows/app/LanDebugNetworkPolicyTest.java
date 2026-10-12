package com.galerows.app;

import android.security.NetworkSecurityPolicy;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import static org.junit.Assume.assumeTrue;

@RunWith(AndroidJUnit4.class)
public class LanDebugNetworkPolicyTest {
    @Test public void debugLanHostAllowsOnlyConfiguredCleartextAddress() {
        assumeTrue("com.galerows.app".equals(
            androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().getTargetContext().getPackageName()));
        NetworkSecurityPolicy policy = NetworkSecurityPolicy.getInstance();
        assertTrue(policy.isCleartextTrafficPermitted("10.245.112.98"));
        assertFalse(policy.isCleartextTrafficPermitted("192.168.0.84"));
        assertFalse(policy.isCleartextTrafficPermitted("10.245.112.245"));
        assertFalse(policy.isCleartextTrafficPermitted("example.com"));
        assertTrue(LanServerPlugin.cleartextPocAllowed(
            androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().getTargetContext()));
    }
}
