# Añade al AndroidManifest el widget y el permiso de ubicación («Estoy aquí»).
import sys
path = sys.argv[1]
s = open(path, encoding='utf-8').read()
receiver = '''        <receiver android:name=".HoyWidget" android:exported="false" android:label="Día a día">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data android:name="android.appwidget.provider" android:resource="@xml/widget_hoy_info" />
        </receiver>
'''
if 'HoyWidget' not in s:
    s = s.replace('</application>', receiver + '    </application>', 1)
for perm in ('android.permission.ACCESS_COARSE_LOCATION', 'android.permission.ACCESS_FINE_LOCATION'):
    if perm not in s:
        s = s.replace('</manifest>', f'    <uses-permission android:name="{perm}" />\n</manifest>', 1)
open(path, 'w', encoding='utf-8').write(s)
print('AndroidManifest actualizado')
