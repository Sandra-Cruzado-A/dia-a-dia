package es.diaadia.app;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Conecta la app con los widgets, el micrófono rápido y lo que se comparte
        registerPlugin(WidgetBridge.class);
        super.onCreate(savedInstanceState);
        if (savedInstanceState == null) LaunchStore.capture(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        LaunchStore.capture(intent);
    }
}
