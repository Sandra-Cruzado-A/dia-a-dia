package es.diaadia.app;

import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.media.ExifInterface;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Base64;
import android.util.Size;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Galería: lee las fotos y vídeos del móvil, su fecha y su GPS, y los mueve entre carpetas
 * (cada carpeta es un álbum en la Galería). Nunca borra fotos: solo mueve y renombra.
 */
@CapacitorPlugin(
    name = "Galeria",
    permissions = {
        @Permission(strings = { "android.permission.READ_MEDIA_IMAGES", "android.permission.READ_MEDIA_VIDEO" }, alias = "media13"),
        @Permission(strings = { "android.permission.READ_EXTERNAL_STORAGE" }, alias = "mediaOld"),
        @Permission(strings = { "android.permission.ACCESS_MEDIA_LOCATION" }, alias = "loc")
    }
)
public class GaleriaBridge extends Plugin {

    private String mediaAlias() {
        return Build.VERSION.SDK_INT >= 33 ? "media13" : "mediaOld";
    }

    private boolean allFiles() {
        return Build.VERSION.SDK_INT >= 30 && Environment.isExternalStorageManager();
    }

    private boolean hasLoc() {
        return Build.VERSION.SDK_INT >= 29 && getPermissionState("loc") == PermissionState.GRANTED;
    }

    private Uri collection(int type, String vol) {
        return type == 3 ? MediaStore.Video.Media.getContentUri(vol) : MediaStore.Images.Media.getContentUri(vol);
    }

    private static String rootOf(String data, String rel, String name) {
        if (data == null || rel == null || name == null) return null;
        String tail = rel + name;
        if (!data.endsWith(tail)) return null;
        return data.substring(0, data.length() - tail.length());
    }

    private static String freeName(String dir, String name) {
        if (!new File(dir, name).exists()) return name;
        int dot = name.lastIndexOf('.');
        String base = dot > 0 ? name.substring(0, dot) : name;
        String ext = dot > 0 ? name.substring(dot) : "";
        for (int n = 1; n < 1000; n++) {
            String cand = base + " (" + n + ")" + ext;
            if (!new File(dir, cand).exists()) return cand;
        }
        return base + " " + System.currentTimeMillis() + ext;
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject r = new JSObject();
        r.put("sdk", Build.VERSION.SDK_INT);
        r.put("allFiles", allFiles());
        r.put("media", allFiles() || getPermissionState(mediaAlias()) == PermissionState.GRANTED);
        r.put("location", hasLoc());
        call.resolve(r);
    }

    @PluginMethod
    public void requestMedia(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 29) {
            requestPermissionForAliases(new String[] { mediaAlias(), "loc" }, call, "mediaCallback");
        } else {
            requestPermissionForAlias(mediaAlias(), call, "mediaCallback");
        }
    }

    @PermissionCallback
    private void mediaCallback(PluginCall call) {
        status(call);
    }

    @PluginMethod
    public void openAllFiles(PluginCall call) {
        if (Build.VERSION.SDK_INT < 30) {
            call.reject("Hace falta Android 11 o más nuevo");
            return;
        }
        Context ctx = getContext();
        try {
            Intent i = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION, Uri.parse("package:" + ctx.getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(i);
        } catch (Exception e) {
            try {
                Intent i = new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION);
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(i);
            } catch (Exception e2) {
                call.reject("No se han podido abrir los ajustes");
                return;
            }
        }
        call.resolve();
    }

    /** Todas las fotos y vídeos: [id, tipo(1 foto, 3 vídeo), volumen, carpeta, nombre, tomada(ms), modificada(s), tamaño, ancho, alto]. */
    @PluginMethod
    public void scan(PluginCall call) {
        if (Build.VERSION.SDK_INT < 29) {
            call.reject("Hace falta Android 10 o más nuevo");
            return;
        }
        ContentResolver cr = getContext().getContentResolver();
        Uri files = MediaStore.Files.getContentUri(MediaStore.VOLUME_EXTERNAL);
        String[] proj = {
            MediaStore.Files.FileColumns._ID,
            MediaStore.Files.FileColumns.MEDIA_TYPE,
            MediaStore.MediaColumns.VOLUME_NAME,
            MediaStore.MediaColumns.RELATIVE_PATH,
            MediaStore.MediaColumns.DISPLAY_NAME,
            MediaStore.MediaColumns.DATE_TAKEN,
            MediaStore.MediaColumns.DATE_MODIFIED,
            MediaStore.MediaColumns.SIZE,
            MediaStore.MediaColumns.WIDTH,
            MediaStore.MediaColumns.HEIGHT,
            MediaStore.MediaColumns.DATA
        };
        String sel = MediaStore.Files.FileColumns.MEDIA_TYPE + " IN (" + MediaStore.Files.FileColumns.MEDIA_TYPE_IMAGE + "," + MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO + ")";
        JSArray items = new JSArray();
        JSObject roots = new JSObject();
        Cursor c = null;
        try {
            c = cr.query(files, proj, sel, null, null);
            if (c != null) {
                while (c.moveToNext()) {
                    String vol = c.getString(2);
                    String rel = c.getString(3);
                    String name = c.getString(4);
                    if (vol == null || rel == null || name == null) continue;
                    JSONArray a = new JSONArray();
                    a.put(c.getLong(0));
                    a.put(c.getInt(1));
                    a.put(vol);
                    a.put(rel);
                    a.put(name);
                    a.put(c.isNull(5) ? 0L : c.getLong(5));
                    a.put(c.isNull(6) ? 0L : c.getLong(6));
                    a.put(c.isNull(7) ? 0L : c.getLong(7));
                    a.put(c.isNull(8) ? 0 : c.getInt(8));
                    a.put(c.isNull(9) ? 0 : c.getInt(9));
                    items.put(a);
                    if (!roots.has(vol)) {
                        String root = rootOf(c.getString(10), rel, name);
                        if (root != null) roots.put(vol, root);
                    }
                }
            }
        } catch (Exception e) {
            if (c != null) c.close();
            call.reject("No se ha podido leer la galería: " + e.getMessage());
            return;
        }
        if (c != null) c.close();
        JSObject r = new JSObject();
        r.put("items", items);
        r.put("roots", roots);
        call.resolve(r);
    }

    /** Coordenadas GPS de las fotos pedidas: [id, latitud, longitud] de las que las tienen. */
    @PluginMethod
    public void gps(PluginCall call) {
        if (Build.VERSION.SDK_INT < 29) {
            call.reject("Hace falta Android 10 o más nuevo");
            return;
        }
        JSArray list = call.getArray("items");
        if (list == null) {
            call.reject("Faltan las fotos");
            return;
        }
        boolean loc = hasLoc();
        ContentResolver cr = getContext().getContentResolver();
        JSArray out = new JSArray();
        for (int i = 0; i < list.length(); i++) {
            InputStream in = null;
            try {
                JSONObject o = list.getJSONObject(i);
                long id = o.getLong("id");
                String vol = o.optString("vol", MediaStore.VOLUME_EXTERNAL_PRIMARY);
                Uri plain = ContentUris.withAppendedId(MediaStore.Images.Media.getContentUri(vol), id);
                if (loc) {
                    try {
                        in = cr.openInputStream(MediaStore.setRequireOriginal(plain));
                    } catch (Exception ignored) {
                        in = null;
                    }
                }
                if (in == null) in = cr.openInputStream(plain);
                if (in == null) continue;
                ExifInterface ex = new ExifInterface(in);
                float[] ll = new float[2];
                if (ex.getLatLong(ll) && !(ll[0] == 0f && ll[1] == 0f)) {
                    JSONArray a = new JSONArray();
                    a.put(id);
                    a.put((double) ll[0]);
                    a.put((double) ll[1]);
                    out.put(a);
                }
            } catch (Exception ignored) {
            } finally {
                if (in != null) {
                    try {
                        in.close();
                    } catch (Exception ignored) {
                    }
                }
            }
        }
        JSObject r = new JSObject();
        r.put("items", out);
        call.resolve(r);
    }

    /** Miniatura pequeña de una foto o vídeo, en JPEG y base64. */
    @PluginMethod
    public void thumb(PluginCall call) {
        if (Build.VERSION.SDK_INT < 29) {
            call.reject("Sin miniaturas");
            return;
        }
        Double idD = call.getDouble("id");
        long id = idD != null ? idD.longValue() : 0L;
        Integer typeI = call.getInt("type", 1);
        int type = typeI != null ? typeI : 1;
        String vol = call.getString("vol", MediaStore.VOLUME_EXTERNAL_PRIMARY);
        Integer sizeI = call.getInt("size", 160);
        int size = sizeI != null ? sizeI : 160;
        try {
            Uri u = ContentUris.withAppendedId(collection(type, vol), id);
            Bitmap b = getContext().getContentResolver().loadThumbnail(u, new Size(size, size), null);
            ByteArrayOutputStream bo = new ByteArrayOutputStream();
            b.compress(Bitmap.CompressFormat.JPEG, 70, bo);
            JSObject r = new JSObject();
            r.put("data", Base64.encodeToString(bo.toByteArray(), Base64.NO_WRAP));
            call.resolve(r);
        } catch (Exception e) {
            call.reject("Sin miniatura");
        }
    }

    /** Mueve fotos a otra carpeta. Cada elemento: {id, type, vol, to, name?}. Devuelve el resultado de cada una, en el mismo orden. */
    @PluginMethod
    public void move(PluginCall call) {
        JSArray list = call.getArray("items");
        if (list == null) {
            call.reject("Faltan las fotos");
            return;
        }
        JSArray out = new JSArray();
        for (int i = 0; i < list.length(); i++) {
            JSONObject res;
            try {
                JSONObject o = list.getJSONObject(i);
                res = moveOne(o.getLong("id"), o.optInt("type", 1), o.optString("vol", MediaStore.VOLUME_EXTERNAL_PRIMARY), o.getString("to"), o.optString("name", ""));
            } catch (Exception e) {
                res = new JSONObject();
                try {
                    res.put("ok", false);
                    res.put("err", String.valueOf(e.getMessage()));
                } catch (Exception ignored) {
                }
            }
            out.put(res);
        }
        JSObject r = new JSObject();
        r.put("results", out);
        call.resolve(r);
    }

    private JSONObject moveOne(long id, int type, String vol, String to, String wanted) throws Exception {
        ContentResolver cr = getContext().getContentResolver();
        Uri u = ContentUris.withAppendedId(collection(type, vol), id);
        String rel = null;
        String name = null;
        String data = null;
        Cursor c = cr.query(u, new String[] { MediaStore.MediaColumns.RELATIVE_PATH, MediaStore.MediaColumns.DISPLAY_NAME, MediaStore.MediaColumns.DATA }, null, null, null);
        if (c != null) {
            if (c.moveToFirst()) {
                rel = c.getString(0);
                name = c.getString(1);
                data = c.getString(2);
            }
            c.close();
        }
        JSONObject r = new JSONObject();
        r.put("id", id);
        if (name == null || rel == null) {
            r.put("ok", false);
            r.put("err", "No está");
            return r;
        }
        r.put("from", rel);
        r.put("name", name);
        String target = (wanted != null && wanted.length() > 0) ? wanted : name;
        if (to.equals(rel) && target.equals(name)) {
            r.put("ok", true);
            r.put("to", rel);
            r.put("newName", name);
            r.put("newId", id);
            return r;
        }
        String root = rootOf(data, rel, name);
        String finalName = root != null ? freeName(root + to, target) : target;
        boolean done = false;
        long newId = id;
        try {
            ContentValues cv = new ContentValues();
            cv.put(MediaStore.MediaColumns.RELATIVE_PATH, to);
            if (!finalName.equals(name)) cv.put(MediaStore.MediaColumns.DISPLAY_NAME, finalName);
            int n = cr.update(u, cv, null, null);
            if (n > 0) {
                Cursor c2 = cr.query(u, new String[] { MediaStore.MediaColumns.RELATIVE_PATH, MediaStore.MediaColumns.DISPLAY_NAME }, null, null, null);
                if (c2 != null) {
                    if (c2.moveToFirst() && to.equals(c2.getString(0))) {
                        done = true;
                        finalName = c2.getString(1);
                    }
                    c2.close();
                }
            }
        } catch (Exception ignored) {
        }
        if (!done && root != null && data != null) {
            File src = new File(data);
            File dir = new File(root + to);
            if (!dir.exists()) dir.mkdirs();
            File dst = new File(dir, finalName);
            if (src.exists() && !dst.exists() && src.renameTo(dst)) {
                done = true;
                newId = rescan(src.getAbsolutePath(), dst.getAbsolutePath(), id);
            }
        }
        r.put("ok", done);
        r.put("to", to);
        r.put("newName", finalName);
        r.put("newId", newId);
        return r;
    }

    private long rescan(String oldPath, final String newPath, long fallback) {
        final long[] holder = { fallback };
        final CountDownLatch latch = new CountDownLatch(2);
        try {
            MediaScannerConnection.scanFile(getContext(), new String[] { oldPath, newPath }, null, (path, uri) -> {
                if (newPath.equals(path) && uri != null) {
                    try {
                        holder[0] = ContentUris.parseId(uri);
                    } catch (Exception ignored) {
                    }
                }
                latch.countDown();
            });
            latch.await(6, TimeUnit.SECONDS);
        } catch (Exception ignored) {
        }
        return holder[0];
    }

    /** Borra carpetas que se han quedado vacías tras mover sus fotos. Solo carpetas de segundo nivel o más (nunca DCIM o Pictures). */
    @PluginMethod
    public void cleanEmpty(PluginCall call) {
        JSArray list = call.getArray("dirs");
        int removed = 0;
        if (list != null) {
            for (int i = 0; i < list.length(); i++) {
                try {
                    JSONObject o = list.getJSONObject(i);
                    String root = o.getString("root");
                    String rel = o.getString("rel");
                    String trimmed = rel.replaceAll("^/+|/+$", "");
                    if (trimmed.split("/").length < 2) continue;
                    File d = new File(root + rel);
                    if (d.isDirectory()) {
                        String[] l = d.list();
                        if (l != null && l.length == 0 && d.delete()) removed++;
                    }
                } catch (Exception ignored) {
                }
            }
        }
        JSObject r = new JSObject();
        r.put("removed", removed);
        call.resolve(r);
    }
}
