package com.galerows.app;

import android.os.Bundle;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PlayStorePlugin.class);
        registerPlugin(ScreenAwakePlugin.class);
        registerPlugin(LanServerPlugin.class);
        registerPlugin(LanSecureClientPlugin.class);
        registerPlugin(LanRoomDiscoveryPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onPause() {
        // Release even if WebView JavaScript is suspended before it can send a command.
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        super.onPause();
    }
}
