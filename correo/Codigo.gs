/**
 * Día a día · lector de correo
 * Mira tus correos nuevos cada hora y, con Gemini, saca lo que conviene apuntar
 * (reservas, viajes, citas, facturas, tareas). La app lo enseña en «Por revisar».
 *
 * Instalación (una sola vez):
 *  1. En script.google.com crea un proyecto nuevo, borra lo que haya y pega este archivo entero.
 *  2. Configuración del proyecto (rueda) → Propiedades del script → añade GEMINI_API_KEY con tu clave de Gemini.
 *  3. Arriba, elige la función «configurar» y pulsa Ejecutar. Acepta los permisos.
 *  4. Implementar → Nueva implementación → Aplicación web. Ejecutar como: yo. Quién tiene acceso: cualquier usuario.
 *  5. Copia la URL de la aplicación web y añádele al final ?k=TU_CLAVE (la clave sale en el registro al ejecutar «configurar»).
 *     Pega esa dirección en la app: ⚙ → Correo.
 */
const ETIQUETA = 'Día a día';

function configurar() {
  const p = PropertiesService.getScriptProperties();
  if (!p.getProperty('TOKEN')) p.setProperty('TOKEN', Utilities.getUuid().replace(/-/g, ''));
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('revisarCorreo').timeBased().everyHours(1).create();
  hoja();
  Logger.log('Listo. Tu clave para la app es: ' + p.getProperty('TOKEN'));
}

function hoja() {
  const p = PropertiesService.getScriptProperties();
  let ss = null;
  const id = p.getProperty('SHEET');
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create('Día a día · correo');
    p.setProperty('SHEET', ss.getId());
    ss.getSheets()[0].appendRow(['id', 'fecha', 'asunto', 'de', 'enlace', 'acciones', 'estado']);
  }
  return ss.getSheets()[0];
}

function revisarCorreo() {
  const key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!key) throw new Error('Falta la propiedad GEMINI_API_KEY');
  const etiqueta = GmailApp.getUserLabelByName(ETIQUETA) || GmailApp.createLabel(ETIQUETA);
  const hilos = GmailApp.search('in:inbox newer_than:3d -label:"' + ETIQUETA + '" -category:promotions -category:social', 0, 25);
  const sh = hoja();
  const hoy = Utilities.formatDate(new Date(), 'Europe/Madrid', 'yyyy-MM-dd');
  hilos.forEach(h => {
    const m = h.getMessages().pop();
    const texto = m.getPlainBody().slice(0, 6000);
    const prompt = 'Hoy es ' + hoy + '. Lee este correo de una persona que vive en Teruel (España) y saca lo que conviene apuntar en su agenda personal: reservas de viaje, vuelos, trenes, hoteles, entradas, citas, facturas y recibos, pedidos que van a llegar y cosas que le piden que haga.\n' +
      'Responde solo con JSON {"acciones":[...]} con estos tipos (pon solo los campos que tengas):\n' +
      '- {"tipo":"evento","titulo":"","fecha":"AAAA-MM-DD","hora":"HH:MM","lugar":""}\n' +
      '- {"tipo":"viaje","destino":"","desde":"AAAA-MM-DD","hasta":"AAAA-MM-DD","transporte":"coche|tren|avion|bus|otro"}\n' +
      '- {"tipo":"gasto","concepto":"","importe":0,"categoria":"","fecha":"AAAA-MM-DD"}\n' +
      '- {"tipo":"tarea","titulo":"","fecha":"AAAA-MM-DD o null"}\n' +
      'Si es publicidad, un boletín o no hay nada que apuntar, responde {"acciones":[]}. No inventes datos.\n' +
      'ASUNTO: ' + m.getSubject() + '\nDE: ' + m.getFrom() + '\nFECHA: ' + m.getDate() + '\nTEXTO:\n' + texto;
    let acciones;
    try { acciones = (gemini(key, prompt).acciones || []).filter(a => a && a.tipo); }
    catch (e) { Logger.log(e); return; }
    if (acciones.length) {
      sh.appendRow([m.getId(), "'" + Utilities.formatDate(m.getDate(), 'Europe/Madrid', 'yyyy-MM-dd HH:mm'), m.getSubject(), m.getFrom(), 'https://mail.google.com/mail/u/0/#all/' + m.getId(), JSON.stringify(acciones), 'pendiente']);
    }
    h.addLabel(etiqueta);
    Utilities.sleep(1500);
  });
}

function gemini(key, prompt) {
  const modelos = ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.5-flash'];
  for (const modelo of modelos) {
    const r = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + modelo + ':generateContent?key=' + encodeURIComponent(key), {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      payload: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } })
    });
    const code = r.getResponseCode();
    if (code === 200) {
      const j = JSON.parse(r.getContentText());
      const t = (j.candidates[0].content.parts || []).map(p => p.text || '').join('').replace(/^```(json)?|```$/g, '').trim();
      return JSON.parse(t);
    }
    if ([404, 429, 500, 503].indexOf(code) < 0) throw new Error(r.getContentText().slice(0, 300));
  }
  throw new Error('Gemini no responde');
}

function doGet(e) {
  const out = o => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
  const p = PropertiesService.getScriptProperties();
  if (!e || !e.parameter || e.parameter.k !== p.getProperty('TOKEN')) return out({ ok: false, error: 'clave' });
  const sh = hoja();
  const data = sh.getDataRange().getValues();
  if (e.parameter.action === 'ack') {
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === e.parameter.id) { sh.getRange(i + 1, 7).setValue(e.parameter.estado === 'ok' ? 'aceptado' : 'descartado'); break; }
    }
    return out({ ok: true });
  }
  const items = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][6] !== 'pendiente') continue;
    let acciones = [];
    try { acciones = JSON.parse(data[i][5]); } catch (err) { acciones = []; }
    items.push({ id: String(data[i][0]), fecha: String(data[i][1]), asunto: data[i][2], de: data[i][3], enlace: data[i][4], acciones: acciones });
  }
  return out({ ok: true, items: items });
}
