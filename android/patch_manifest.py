# Añade al AndroidManifest los widgets, el botón rápido, el icono «Apunta día», compartir y los permisos (también los de la galería).
import sys, re
path = sys.argv[1]
s = open(path, encoding='utf-8').read()
def receiver(cls, label, info):
    return f"""        <receiver android:name=".{cls}" android:exported="false" android:label="{label}">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data android:name="android.appwidget.provider" android:resource="@xml/{info}" />
        </receiver>
"""
extra = ''
if 'HoyWidget' not in s: extra += receiver('HoyWidget', 'Día a día · Hoy', 'widget_hoy_info')
if 'CalWidget' not in s: extra += receiver('CalWidget', 'Día a día · Calendario', 'widget_cal_info')
if 'TareasWidget' not in s: extra += receiver('TareasWidget', 'Día a día · Tareas', 'widget_tareas_info')
if 'ApuntaTile' not in s:
    extra += """        <service android:name=".ApuntaTile" android:exported="true" android:label="Apunta día" android:icon="@drawable/ic_mic" android:permission="android.permission.BIND_QUICK_SETTINGS_TILE">
            <intent-filter>
                <action android:name="android.service.quicksettings.action.QS_TILE" />
            </intent-filter>
        </service>
"""
if 'ApuntaDia' not in s:
    extra += """        <activity-alias android:name=".ApuntaDia" android:targetActivity=".MainActivity" android:label="Apunta día" android:icon="@drawable/ic_apunta" android:roundIcon="@drawable/ic_apunta" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity-alias>
"""
s = s.replace('</application>', extra + '    </application>', 1)
# compartir con la app: filtros dentro de MainActivity
if 'android.intent.action.SEND' not in s:
    m = re.search(r'<activity[^>]*android:name="\.MainActivity"[^>]*>', s, re.S)
    if m:
        end = s.index('</activity>', m.end())
        filters = ''.join(f"""
            <intent-filter>
                <action android:name="android.intent.action.{a}" />
                <category android:name="android.intent.category.DEFAULT" />
                <data android:mimeType="{t}" />
            </intent-filter>""" for a, t in [('SEND','text/plain'),('SEND','image/*'),('SEND','application/pdf'),('SEND_MULTIPLE','image/*')])
        s = s[:end] + filters + '\n        ' + s[end:]
perms = ['android.permission.ACCESS_COARSE_LOCATION', 'android.permission.ACCESS_FINE_LOCATION', 'android.permission.RECORD_AUDIO', 'android.permission.READ_MEDIA_IMAGES', 'android.permission.READ_MEDIA_VIDEO', 'android.permission.ACCESS_MEDIA_LOCATION', 'android.permission.MANAGE_EXTERNAL_STORAGE']
for perm in perms:
    if perm not in s:
        s = s.replace('</manifest>', f'    <uses-permission android:name="{perm}" />\n</manifest>', 1)
if 'android.permission.READ_EXTERNAL_STORAGE' not in s:
    s = s.replace('</manifest>', '    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />\n</manifest>', 1)
if 'android.speech.RecognitionService' not in s:
    s = s.replace('<application', '<queries>\n        <intent>\n            <action android:name="android.speech.RecognitionService" />\n        </intent>\n    </queries>\n\n    <application', 1)
open(path, 'w', encoding='utf-8').write(s)
print('AndroidManifest actualizado')
