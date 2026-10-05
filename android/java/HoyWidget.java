package es.diaadia.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import org.json.JSONObject;

/** Widget «Hoy»: tiempo, agenda de hoy y mañana, y lo gastado hoy. */
public class HoyWidget extends AppWidgetProvider {
    static final String PREFS = "diaadia_widget";
    static final String KEY = "data";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) render(context, manager, id);
        // Cada media hora, aunque no abras la app: pone al día el tiempo en segundo plano
        final Context app = context.getApplicationContext();
        final PendingResult pending = goAsync();
        new Thread(() -> {
            try {
                WeatherRefresh.run(app);
            } catch (Exception ignored) {
            } finally {
                pending.finish();
            }
        }).start();
    }

    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, HoyWidget.class));
        for (int id : ids) render(context, manager, id);
    }

    static void render(Context context, AppWidgetManager manager, int id) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_hoy);
        String title = "Día a día";
        String weather = "";
        String agenda = "Abre la app para ponerlo al día";
        String money = "";
        String fondo = "transparente";
        try {
            String raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null);
            if (raw != null) {
                String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
                JSONObject root = new JSONObject(raw);
                fondo = root.optString("fondo", fondo);
                JSONObject dias = root.optJSONObject("dias");
                JSONObject d = dias != null ? dias.optJSONObject(today) : null;
                if (d != null) {
                    title = d.optString("titulo", title);
                    weather = d.optString("tiempo", "");
                    agenda = d.optString("agenda", "");
                    money = d.optString("gasto", "");
                }
            }
        } catch (Exception ignored) { }
        int bg = "negro".equals(fondo) ? R.drawable.widget_bg
            : "semi".equals(fondo) ? R.drawable.widget_bg_semi
            : R.drawable.widget_bg_clear;
        v.setInt(R.id.w_root, "setBackgroundResource", bg);
        v.setTextViewText(R.id.w_title, title);
        v.setTextViewText(R.id.w_weather, weather);
        v.setTextViewText(R.id.w_agenda, agenda);
        v.setTextViewText(R.id.w_money, money);
        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.w_root, pi);
        manager.updateAppWidget(id, v);
    }
}
