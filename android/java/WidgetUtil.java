package es.diaadia.app;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import org.json.JSONObject;

/** Utilidades comunes de los widgets. */
public class WidgetUtil {
    static JSONObject data(Context ctx) {
        try {
            String raw = ctx.getSharedPreferences(HoyWidget.PREFS, Context.MODE_PRIVATE).getString(HoyWidget.KEY, null);
            return raw != null ? new JSONObject(raw) : null;
        } catch (Exception e) {
            return null;
        }
    }

    static int bg(JSONObject root) {
        String fondo = root != null ? root.optString("fondo", "transparente") : "transparente";
        if ("negro".equals(fondo)) return R.drawable.widget_bg;
        if ("semi".equals(fondo)) return R.drawable.widget_bg_semi;
        return R.drawable.widget_bg_clear;
    }

    static PendingIntent open(Context ctx, String mode, int req) {
        Intent i = new Intent(ctx, MainActivity.class);
        if (mode != null) i.putExtra("dia_mode", mode);
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(ctx, req, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void updateAll(Context ctx) {
        HoyWidget.updateAll(ctx);
        CalWidget.updateAll(ctx);
        TareasWidget.updateAll(ctx);
    }
}
