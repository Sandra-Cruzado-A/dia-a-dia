package es.diaadia.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.widget.RemoteViews;
import java.util.Calendar;
import java.util.GregorianCalendar;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/** Widget «Calendario»: el mes actual con los días que tienen algo apuntado. */
public class CalWidget extends AppWidgetProvider {
    static final String[] MESES = { "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre" };
    static final String[] DIAS = { "L", "M", "X", "J", "V", "S", "D" };

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) render(context, manager, id);
    }

    static void updateAll(Context context) {
        AppWidgetManager m = AppWidgetManager.getInstance(context);
        int[] ids = m.getAppWidgetIds(new ComponentName(context, CalWidget.class));
        for (int id : ids) render(context, m, id);
    }

    static void render(Context ctx, AppWidgetManager m, int id) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_cal);
        JSONObject root = WidgetUtil.data(ctx);
        v.setInt(R.id.w_root, "setBackgroundResource", WidgetUtil.bg(root));
        v.setImageViewBitmap(R.id.w_calimg, draw(root != null ? root.optJSONObject("cal") : null));
        v.setOnClickPendingIntent(R.id.w_root, WidgetUtil.open(ctx, "cal", 21));
        m.updateAppWidget(id, v);
    }

    static Bitmap draw(JSONObject cal) {
        int W = 720, H = 640;
        Bitmap bm = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(bm);
        Calendar now = Calendar.getInstance();
        int y = now.get(Calendar.YEAR), mo = now.get(Calendar.MONTH), today = now.get(Calendar.DAY_OF_MONTH);
        GregorianCalendar f = new GregorianCalendar(y, mo, 1);
        int first = (f.get(Calendar.DAY_OF_WEEK) + 5) % 7;
        int days = f.getActualMaximum(Calendar.DAY_OF_MONTH);
        String key = String.format(Locale.US, "%04d-%02d", y, mo + 1);
        JSONObject marks = cal != null && key.equals(cal.optString("mes")) ? cal.optJSONObject("marcas") : null;

        Paint title = new Paint(Paint.ANTI_ALIAS_FLAG);
        title.setColor(Color.parseColor("#F4EFE3"));
        title.setTextSize(52f);
        title.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        title.setShadowLayer(5f, 0f, 2f, 0xB3000000);
        cv.drawText(MESES[mo], 24f, 62f, title);
        Paint year = new Paint(title);
        year.setColor(Color.parseColor("#F2C230"));
        year.setTextSize(30f);
        cv.drawText(String.valueOf(y), 24f + title.measureText(MESES[mo]) + 16f, 62f, year);

        float top = 96f, cw = (W - 24f) / 7f, ch = (H - top - 16f) / 7f;
        Paint head = new Paint(Paint.ANTI_ALIAS_FLAG);
        head.setColor(Color.parseColor("#A39E92"));
        head.setTextSize(26f);
        head.setTextAlign(Paint.Align.CENTER);
        head.setShadowLayer(4f, 0f, 1f, 0xB3000000);
        for (int i = 0; i < 7; i++) cv.drawText(DIAS[i], 12f + cw * i + cw / 2f, top + 30f, head);

        Paint num = new Paint(Paint.ANTI_ALIAS_FLAG);
        num.setTextSize(32f);
        num.setTextAlign(Paint.Align.CENTER);
        num.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        Paint circle = new Paint(Paint.ANTI_ALIAS_FLAG);
        circle.setColor(Color.parseColor("#F2C230"));
        Paint dot = new Paint(Paint.ANTI_ALIAS_FLAG);

        for (int d = 1; d <= days; d++) {
            int idx = first + d - 1, row = idx / 7, col = idx % 7;
            float cx = 12f + cw * col + cw / 2f, cy = top + ch * (row + 1) + ch * 0.42f;
            if (d == today) {
                cv.drawCircle(cx, cy - 11f, 26f, circle);
                num.setColor(Color.parseColor("#0A0A0B"));
                num.clearShadowLayer();
            } else {
                num.setColor(Color.parseColor("#F4EFE3"));
                num.setShadowLayer(4f, 0f, 1f, 0xB3000000);
            }
            cv.drawText(String.valueOf(d), cx, cy, num);
            JSONArray cols = marks != null ? marks.optJSONArray(String.valueOf(d)) : null;
            if (cols != null && cols.length() > 0) {
                int n = Math.min(3, cols.length());
                float start = cx - (n - 1) * 7f;
                for (int k = 0; k < n; k++) {
                    try {
                        dot.setColor(Color.parseColor(cols.optString(k, "#F2C230")));
                    } catch (Exception e) {
                        dot.setColor(Color.parseColor("#F2C230"));
                    }
                    cv.drawCircle(start + k * 14f, cy + 22f, 5f, dot);
                }
            }
        }
        return bm;
    }
}
