package es.diaadia.app;

import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.Context;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.util.Base64;
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
import java.io.InputStream;
import java.util.ArrayList;

/** Puente entre la app y Android: widgets, cómo se abrió la app, lo compartido y las capturas. */
@CapacitorPlugin(
    name = "WidgetBridge",
    permissions = {
        @Permission(strings = { "android.permission.READ_MEDIA_IMAGES" }, alias = "photos13"),
        @Permission(strings = { "android.permission.READ_EXTERNAL_STORAGE" }, alias = "photosOld")
    }
)
public class WidgetBridge extends Plugin {

    @PluginMethod
    public void update(PluginCall call) {
        String data = call.getString("data", "{}");
        Context ctx = getContext();
        ctx.getSharedPreferences(HoyWidget.PREFS, Context.MODE_PRIVATE).edit().putString(HoyWidget.KEY, data).apply();
        WidgetUtil.updateAll(ctx);
        call.resolve();
    }

    @PluginMethod
    public void getLaunch(PluginCall call) {
        JSObject r = new JSObject();
        if (LaunchStore.mode != null) {
            r.put("mode", LaunchStore.mode);
            LaunchStore.mode = null;
        }
        call.resolve(r);
    }

    @PluginMethod
    public void getShared(PluginCall call) {
        JSObject r = new JSObject();
        if (LaunchStore.text != null) {
            r.put("text", LaunchStore.text);
            LaunchStore.text = null;
        }
        JSArray files = new JSArray();
        ArrayList<Uri> list = new ArrayList<>(LaunchStore.uris);
        LaunchStore.uris.clear();
        for (Uri u : list) {
            try {
                JSObject f = readUri(u, 25 * 1024 * 1024);
                if (f != null) files.put(f);
            } catch (Exception ignored) {
            }
        }
        r.put("files", files);
        call.resolve(r);
    }

    private JSObject readUri(Uri u, int max) throws Exception {
        ContentResolver cr = getContext().getContentResolver();
        String type = cr.getType(u);
        String name = "archivo";
        Cursor c = cr.query(u, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null);
        if (c != null) {
            if (c.moveToFirst()) {
                int i = c.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (i >= 0) name = c.getString(i);
            }
            c.close();
        }
        InputStream in = cr.openInputStream(u);
        if (in == null) return null;
        ByteArrayOutputStream bo = new ByteArrayOutputStream();
        byte[] buf = new byte[65536];
        int n;
        int tot = 0;
        while ((n = in.read(buf)) > 0) {
            bo.write(buf, 0, n);
            tot += n;
            if (tot > max) break;
        }
        in.close();
        JSObject f = new JSObject();
        f.put("name", name);
        f.put("type", type != null ? type : "");
        f.put("data", Base64.encodeToString(bo.toByteArray(), Base64.NO_WRAP));
        return f;
    }

    private String photoAlias() {
        return Build.VERSION.SDK_INT >= 33 ? "photos13" : "photosOld";
    }

    @PluginMethod
    public void requestPhotos(PluginCall call) {
        if (getPermissionState(photoAlias()) == PermissionState.GRANTED) {
            JSObject r = new JSObject();
            r.put("granted", true);
            call.resolve(r);
            return;
        }
        requestPermissionForAlias(photoAlias(), call, "photosCallback");
    }

    @PermissionCallback
    private void photosCallback(PluginCall call) {
        JSObject r = new JSObject();
        r.put("granted", getPermissionState(photoAlias()) == PermissionState.GRANTED);
        call.resolve(r);
    }

    @PluginMethod
    public void findImages(PluginCall call) {
        if (getPermissionState(photoAlias()) != PermissionState.GRANTED) {
            call.reject("Sin permiso para ver las fotos");
            return;
        }
        String contains = call.getString("contains", "");
        Double sinceD = call.getDouble("since");
        long since = sinceD != null ? sinceD.longValue() : 0L;
        JSArray images = new JSArray();
        Uri base = MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
        String[] proj = { MediaStore.Images.Media._ID, MediaStore.Images.Media.DISPLAY_NAME, MediaStore.Images.Media.DATE_ADDED };
        String sel = MediaStore.Images.Media.DISPLAY_NAME + " LIKE ? AND " + MediaStore.Images.Media.DATE_ADDED + " > ?";
        String[] args = { "%" + contains + "%", String.valueOf(since) };
        Cursor c = getContext().getContentResolver().query(base, proj, sel, args, MediaStore.Images.Media.DATE_ADDED + " DESC");
        if (c != null) {
            int count = 0;
            while (c.moveToNext() && count < 20) {
                long id = c.getLong(0);
                JSObject o = new JSObject();
                o.put("uri", ContentUris.withAppendedId(base, id).toString());
                o.put("name", c.getString(1));
                o.put("date", c.getLong(2));
                images.put(o);
                count++;
            }
            c.close();
        }
        JSObject r = new JSObject();
        r.put("images", images);
        call.resolve(r);
    }

    @PluginMethod
    public void readImage(PluginCall call) {
        String uri = call.getString("uri");
        Integer maxI = call.getInt("max", 2000);
        int max = maxI != null ? maxI : 2000;
        try {
            ContentResolver cr = getContext().getContentResolver();
            Uri u = Uri.parse(uri);
            BitmapFactory.Options o = new BitmapFactory.Options();
            o.inJustDecodeBounds = true;
            InputStream in = cr.openInputStream(u);
            BitmapFactory.decodeStream(in, null, o);
            if (in != null) in.close();
            int sample = 1;
            while (Math.max(o.outWidth, o.outHeight) / (sample * 2) >= max) sample *= 2;
            BitmapFactory.Options o2 = new BitmapFactory.Options();
            o2.inSampleSize = sample;
            in = cr.openInputStream(u);
            Bitmap b = BitmapFactory.decodeStream(in, null, o2);
            if (in != null) in.close();
            if (b == null) {
                call.reject("No se puede leer la imagen");
                return;
            }
            float s = Math.min(1f, (float) max / Math.max(b.getWidth(), b.getHeight()));
            if (s < 1f) b = Bitmap.createScaledBitmap(b, Math.round(b.getWidth() * s), Math.round(b.getHeight() * s), true);
            ByteArrayOutputStream bo = new ByteArrayOutputStream();
            b.compress(Bitmap.CompressFormat.JPEG, 85, bo);
            JSObject r = new JSObject();
            r.put("data", Base64.encodeToString(bo.toByteArray(), Base64.NO_WRAP));
            r.put("type", "image/jpeg");
            call.resolve(r);
        } catch (Exception e) {
            call.reject("No se puede leer la imagen");
        }
    }
}
