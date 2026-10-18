package com.galerows.app;

import android.app.Activity;
import android.view.WindowManager;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Minimal Capacitor 8 bridge; no wake lock permission or external dependency. */
@CapacitorPlugin(name = "ScreenAwake")
public class ScreenAwakePlugin extends Plugin {
    @PluginMethod
    public void setEnabled(PluginCall call) {
        Boolean enabled = call.getBoolean("enabled");
        Activity activity = getActivity();

        if (enabled == null || activity == null) {
            call.reject("Screen awake requires an active Android activity and boolean enabled flag.");
            return;
        }

        activity.runOnUiThread(() -> {
            if (enabled) {
                activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            } else {
                activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            }
            call.resolve();
        });
    }
}
