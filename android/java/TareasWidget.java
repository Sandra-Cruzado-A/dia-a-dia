package es.diaadia.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

/** Widget «Tareas»: las tareas de hoy y las que no tienen fecha. */
public class TareasWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) render(context, manager, id);
    }

    static void updateAll(Context context) {
        AppWidgetManager m = AppWidgetManager.getInstance(context);
        int[] ids = m.getAppWidgetIds(new ComponentName(context, TareasWidget.class));
        for (int id : ids) render(context, m, id);
    }

    static void render(Context ctx, AppWidgetManager m, int id) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_tareas);
        JSONObject root = WidgetUtil.data(ctx);
        v.setInt(R.id.w_root, "setBackgroundResource", WidgetUtil.bg(root));
        JSONObject t = root != null ? root.optJSONObject("tareas") : null;
        String title = "Tareas";
        StringBuilder sb = new StringBuilder();
        if (t != null) {
            int total = t.optInt("total", 0);
            if (total > 0) title = "Tareas (" + total + ")";
            JSONArray l = t.optJSONArray("lista");
            if (l != null) {
                for (int i = 0; i < l.length() && i < 9; i++) {
                    if (sb.length() > 0) sb.append("\n");
                    sb.append("○  ").append(l.optString(i, ""));
                }
            }
        }
        v.setTextViewText(R.id.w_ttitle, title);
        v.setTextViewText(R.id.w_tlist, sb.length() > 0 ? sb.toString() : (t == null ? "Abre la app para ponerlo al día" : "Nada pendiente"));
        v.setOnClickPendingIntent(R.id.w_root, WidgetUtil.open(ctx, "tareas", 31));
        v.setOnClickPendingIntent(R.id.w_tmic, WidgetUtil.open(ctx, "dictar", 32));
        m.updateAppWidget(id, v);
    }
}
