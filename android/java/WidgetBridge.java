package es.diaadia.app;

import android.content.Context;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** La app le pasa aquí lo que debe mostrar el widget (texto ya preparado para cada día). */
@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridge extends Plugin {
    @PluginMethod
    public void update(PluginCall call) {
        String data = call.getString("data", "{}");
        Context ctx = getContext();
        ctx.getSharedPreferences(HoyWidget.PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(HoyWidget.KEY, data)
            .apply();
        HoyWidget.updateAll(ctx);
        call.resolve();
    }
}
