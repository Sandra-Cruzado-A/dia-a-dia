package es.diaadia.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.widget.RemoteViews;
import java.util.Calendar;
import java.util.GregorianCalendar;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/** Widget «Calendario»: el mes actual con lo apuntado en cada día, en texto. */
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

    static int color(String s, int def) {
        try {
            return Color.parseColor(s);
        } catch (Exception e) {
            return def;
        }
    }

    /** Recorta el texto para que quepa en el ancho dado. */
    static String fit(String t, Paint p, float w) {
        if (p.measureText(t) <= w) return t;
        String e = "…";
        int n = t.length();
        while (n > 1 && p.measureText(t.substring(0, n) + e) > w) n--;
        return t.substring(0, n) + e;
    }

    static Bitmap draw(JSONObject cal) {
        int W = 1080, H = 1000;
        Bitmap bm = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(bm);
        Calendar now = Calendar.getInstance();
        int y = now.get(Calendar.YEAR), mo = now.get(Calendar.MONTH), today = now.get(Calendar.DAY_OF_MONTH);
        GregorianCalendar f = new GregorianCalendar(y, mo, 1);
        int first = (f.get(Calendar.DAY_OF_WEEK) + 5) % 7;
        int days = f.getActualMaximum(Calendar.DAY_OF_MONTH);
        int rows = (first + days + 6) / 7;
        String key = String.format(Locale.US, "%04d-%02d", y, mo + 1);
        JSONObject marks = cal != null && key.equals(cal.optString("mes")) ? cal.optJSONObject("marcas") : null;
        int ink = color("#F4EFE3", Color.WHITE), gold = color("#F2C230", Color.YELLOW), muted = color("#A39E92", Color.GRAY), dark = color("#0A0A0B", Color.BLACK);

        Paint title = new Paint(Paint.ANTI_ALIAS_FLAG);
        title.setColor(ink);
        title.setTextSize(64f);
        title.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        title.setShadowLayer(6f, 0f, 2f, 0xB3000000);
        cv.drawText(MESES[mo], 20f, 70f, title);
        Paint year = new Paint(title);
        year.setColor(gold);
        year.setTextSize(36f);
        cv.drawText(String.valueOf(y), 20f + title.measureText(MESES[mo]) + 18f, 70f, year);

        float top = 100f, left = 8f, cw = (W - 16f) / 7f;
        Paint head = new Paint(Paint.ANTI_ALIAS_FLAG);
        head.setColor(muted);
        head.setTextSize(30f);
        head.setTextAlign(Paint.Align.CENTER);
        head.setShadowLayer(4f, 0f, 1f, 0xB3000000);
        for (int i = 0; i < 7; i++) cv.drawText(DIAS[i], left + cw * i + cw / 2f, top + 30f, head);
        float gridTop = top + 46f, ch = (H - gridTop - 6f) / rows;

        Paint line = new Paint(Paint.ANTI_ALIAS_FLAG);
        line.setColor(0x26F4EFE3);
        line.setStrokeWidth(2f);
        Paint num = new Paint(Paint.ANTI_ALIAS_FLAG);
        num.setTextSize(32f);
        num.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        Paint circle = new Paint(Paint.ANTI_ALIAS_FLAG);
        circle.setColor(gold);
        Paint pill = new Paint(Paint.ANTI_ALIAS_FLAG);
        Paint lab = new Paint(Paint.ANTI_ALIAS_FLAG);
        lab.setTextSize(23f);
        lab.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        lab.setColor(dark);
        Paint more = new Paint(Paint.ANTI_ALIAS_FLAG);
        more.setTextSize(22f);
        more.setColor(muted);

        for (int r = 0; r <= rows; r++) cv.drawLine(left, gridTop + ch * r, W - left, gridTop + ch * r, line);
        float pillH = 30f, gap = 4f;
        int maxPills = Math.max(1, (int) ((ch - 50f) / (pillH + gap)));
        for (int d = 1; d <= days; d++) {
            int idx = first + d - 1, row = idx / 7, col = idx % 7;
            float x0 = left + cw * col, y0 = gridTop + ch * row;
            float nx = x0 + 10f, ny = y0 + 36f;
            if (d == today) {
                cv.drawCircle(nx + 18f, ny - 11f, 22f, circle);
                num.setColor(dark);
                num.setTextAlign(Paint.Align.CENTER);
                num.clearShadowLayer();
                cv.drawText(String.valueOf(d), nx + 18f, ny, num);
            } else {
                num.setColor(ink);
                num.setTextAlign(Paint.Align.LEFT);
                num.setShadowLayer(4f, 0f, 1f, 0xB3000000);
                cv.drawText(String.valueOf(d), nx, ny, num);
            }
            JSONArray items = marks != null ? marks.optJSONArray(String.valueOf(d)) : null;
            if (items == null) continue;
            int n = items.length();
            int show = n > maxPills ? maxPills - 1 : n;
            float py = y0 + 48f;
            for (int k = 0; k < show; k++) {
                JSONObject it = items.optJSONObject(k);
                if (it == null) continue;
                pill.setColor(color(it.optString("c", "#F2C230"), gold));
                RectF rc = new RectF(x0 + 4f, py, x0 + cw - 4f, py + pillH);
                cv.drawRoundRect(rc, 8f, 8f, pill);
                cv.drawText(fit(it.optString("t", ""), lab, cw - 16f), x0 + 9f, py + 22f, lab);
                py += pillH + gap;
            }
            if (n > show) cv.drawText("+" + (n - show), x0 + 9f, py + 22f, more);
        }
        return bm;
    }
}
