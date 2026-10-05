package es.diaadia.app;

import android.content.Context;
import android.content.SharedPreferences;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Locale;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;

/** Pone al día el tiempo del widget sin abrir la app (Open-Meteo, gratis y sin clave). */
public class WeatherRefresh {
    static final long MIN_INTERVAL = 50L * 60L * 1000L;

    static void run(Context ctx) throws Exception {
        SharedPreferences sp = ctx.getSharedPreferences(HoyWidget.PREFS, Context.MODE_PRIVATE);
        String raw = sp.getString(HoyWidget.KEY, null);
        if (raw == null) return;
        if (System.currentTimeMillis() - sp.getLong("weather_at", 0L) < MIN_INTERVAL) return;
        JSONObject root = new JSONObject(raw);
        JSONObject dias = root.optJSONObject("dias");
        if (dias == null) return;
        Map<String, JSONObject> cache = new HashMap<>();
        boolean changed = false;
        Iterator<String> keys = dias.keys();
        while (keys.hasNext()) {
            String date = keys.next();
            JSONObject d = dias.optJSONObject(date);
            if (d == null) continue;
            JSONObject loc = d.optJSONObject("loc");
            if (loc == null || !loc.has("lat") || !loc.has("lon")) continue;
            double lat = loc.optDouble("lat");
            double lon = loc.optDouble("lon");
            String key = String.format(Locale.US, "%.3f,%.3f", lat, lon);
            JSONObject f = cache.get(key);
            if (f == null) {
                f = fetch(lat, lon);
                cache.put(key, f);
            }
            JSONObject daily = f.optJSONObject("daily");
            if (daily == null) continue;
            JSONArray times = daily.optJSONArray("time");
            JSONArray codes = daily.optJSONArray("weather_code");
            JSONArray maxs = daily.optJSONArray("temperature_2m_max");
            JSONArray mins = daily.optJSONArray("temperature_2m_min");
            if (times == null || codes == null || maxs == null || mins == null) continue;
            for (int i = 0; i < times.length(); i++) {
                if (date.equals(times.optString(i))) {
                    long max = Math.round(maxs.optDouble(i));
                    long min = Math.round(mins.optDouble(i));
                    d.put("tiempo", loc.optString("name", "Teruel") + ": " + describe(codes.optInt(i)) + ", " + max + "° / " + min + "°");
                    changed = true;
                    break;
                }
            }
        }
        if (changed) {
            sp.edit()
                .putString(HoyWidget.KEY, root.toString())
                .putLong("weather_at", System.currentTimeMillis())
                .apply();
            HoyWidget.updateAll(ctx);
        }
    }

    static JSONObject fetch(double lat, double lon) throws Exception {
        String u = String.format(Locale.US,
            "https://api.open-meteo.com/v1/forecast?latitude=%.4f&longitude=%.4f&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=8",
            lat, lon);
        HttpURLConnection c = (HttpURLConnection) new URL(u).openConnection();
        c.setConnectTimeout(8000);
        c.setReadTimeout(8000);
        try {
            BufferedReader r = new BufferedReader(new InputStreamReader(c.getInputStream(), "UTF-8"));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = r.readLine()) != null) sb.append(line);
            r.close();
            return new JSONObject(sb.toString());
        } finally {
            c.disconnect();
        }
    }

    static String describe(int c) {
        switch (c) {
            case 0: return "despejado";
            case 1: return "casi despejado";
            case 2: return "nubes y claros";
            case 3: return "nublado";
            case 45: case 48: return "niebla";
            case 51: return "llovizna débil";
            case 53: return "llovizna";
            case 55: return "llovizna intensa";
            case 56: case 57: return "llovizna helada";
            case 61: return "lluvia débil";
            case 63: return "lluvia";
            case 65: return "lluvia fuerte";
            case 66: case 67: return "lluvia helada";
            case 71: return "nieve débil";
            case 73: return "nieve";
            case 75: return "nieve fuerte";
            case 77: return "granizo menudo";
            case 80: return "chubascos débiles";
            case 81: return "chubascos";
            case 82: return "chubascos fuertes";
            case 85: case 86: return "chubascos de nieve";
            case 95: return "tormentas";
            case 96: case 99: return "tormentas con granizo";
            default: return "nublado";
        }
    }
}
