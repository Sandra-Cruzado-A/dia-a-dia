package es.diaadia.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import java.util.ArrayList;

/** Guarda cómo se ha abierto la app (Apunta día, un widget) y lo que se ha compartido con ella. */
public class LaunchStore {
    static String mode = null;
    static String text = null;
    static final ArrayList<Uri> uris = new ArrayList<>();

    static void capture(Intent intent) {
        if (intent == null) return;
        String m = intent.getStringExtra("dia_mode");
        if (m != null) mode = m;
        if (intent.getComponent() != null && intent.getComponent().getClassName().endsWith("ApuntaDia")) mode = "dictar";
        String act = intent.getAction();
        if (Intent.ACTION_SEND.equals(act)) {
            String t = intent.getStringExtra(Intent.EXTRA_TEXT);
            String sub = intent.getStringExtra(Intent.EXTRA_SUBJECT);
            if (t != null) text = (sub != null && !t.contains(sub) ? sub + "\n" : "") + t;
            Uri u = stream(intent);
            if (u != null) uris.add(u);
        } else if (Intent.ACTION_SEND_MULTIPLE.equals(act)) {
            ArrayList<Uri> l = streams(intent);
            if (l != null) uris.addAll(l);
        }
    }

    @SuppressWarnings("deprecation")
    static Uri stream(Intent i) {
        if (Build.VERSION.SDK_INT >= 33) return i.getParcelableExtra(Intent.EXTRA_STREAM, Uri.class);
        return (Uri) i.getParcelableExtra(Intent.EXTRA_STREAM);
    }

    @SuppressWarnings("deprecation")
    static ArrayList<Uri> streams(Intent i) {
        if (Build.VERSION.SDK_INT >= 33) return i.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri.class);
        return i.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
    }
}
