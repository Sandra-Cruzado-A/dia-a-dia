// Busca eventos en Teruel y los guarda en eventos.json.
// Lo ejecuta GitHub cada mañana (.github/workflows/eventos.yml). Necesita el secreto GEMINI_API_KEY.
//
// Cómo funciona:
// 1. Lee las portadas y agendas de varios periódicos y webs de Teruel, y abre las noticias que parecen anunciar algo.
// 2. Le pasa ese texto a Gemini para que saque los eventos con fecha.
// 3. Además, le pide a Gemini que busque en Google (redes, agendas, periódicos) eventos de los próximos días.
// 4. Junta todo con lo que ya había, quita duplicados y lo que ya ha pasado, y guarda eventos.json.

import fs from 'node:fs/promises';

const KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';
const BASE = process.env.GEMINI_BASE || 'https://generativelanguage.googleapis.com/v1beta';
const OUT = process.env.EVENTOS_FILE || 'eventos.json';
const DAYS_AHEAD = 60;

const SOURCES = process.env.SOURCES_JSON ? JSON.parse(process.env.SOURCES_JSON) : [
  { name: 'Eco de Teruel', url: 'https://ecodeteruel.tv/' },
  { name: 'Diario de Teruel', url: 'https://www.diariodeteruel.es/' },
  { name: 'Diario de Teruel (cultura)', url: 'https://www.diariodeteruel.es/cultura' },
  { name: 'Teatro Marín', url: 'https://teatromarin.es/programacion/' },
  { name: 'irdeocio.es', url: 'https://irdeocio.es/agenda-cultural-y-ocio-de-teruel.html' },
  { name: 'Heraldo (Teruel)', url: 'https://www.heraldo.es/noticias/aragon/teruel/' },
  { name: 'El Periódico de Aragón (Teruel)', url: 'https://www.elperiodicodearagon.com/teruel/' },
  { name: 'Turismo de Teruel', url: 'https://turismo.teruel.es/que-hacer/agenda-de-actividades/' }
];

const KEYWORDS = /(concierto|festival|feria|fiesta|jornada|presenta|presentaci|teatro|exposici|charla|conferencia|actuaci|carrera|marcha|taller|mercado|recreaci|cine|danza|ballet|congreso|encuentro|ruta|visita guiada|programa|agenda|partido|torneo|campeonato|semana|certamen|muestra)/i;
const MONTHS = '(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)';
const DATE_RE = new RegExp('\\b\\d{1,2} de ' + MONTHS, 'i');

const madridDate = d => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
const today = madridDate(new Date());
const limit = madridDate(new Date(Date.now() + DAYS_AHEAD * 864e5));

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const slug = s => norm(s).replace(/ /g, '-').slice(0, 60);

async function get(url, ms = 20000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DiaADiaBot/1.0)', 'Accept-Language': 'es-ES,es' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text();
  } finally { clearTimeout(t); }
}

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h\d)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#8217;|&#39;/g, "'").replace(/&#8220;|&#8221;/g, '"').replace(/&#\d+;/g, ' ')
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}

function links(html, base) {
  const out = [];
  const re = /<a\s[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const text = htmlToText(m[2]).replace(/\s+/g, ' ').trim();
    if (text.length < 25) continue;
    let href;
    try { href = new URL(m[1], base).href; } catch { continue; }
    if (new URL(href).host !== new URL(base).host) continue;
    out.push({ href, text });
  }
  return out;
}

async function collect() {
  const pages = [];
  const candidates = new Map();
  for (const src of SOURCES) {
    try {
      const html = await get(src.url);
      pages.push({ source: src.name, url: src.url, text: htmlToText(html).slice(0, 12000) });
      for (const l of links(html, src.url)) {
        if ((KEYWORDS.test(l.text) || DATE_RE.test(l.text)) && !candidates.has(l.href)) candidates.set(l.href, { ...l, source: src.name });
      }
      console.log('OK', src.name);
    } catch (e) {
      console.log('No se pudo leer', src.name, '-', e.message);
    }
  }
  const arts = [];
  for (const c of [...candidates.values()].slice(0, 30)) {
    try {
      const text = htmlToText(await get(c.href)).slice(0, 3500);
      arts.push({ source: c.source, url: c.href, title: c.text, text });
    } catch { /* se ignora */ }
  }
  console.log(`Leídas ${pages.length} webs y ${arts.length} noticias`);
  return { pages, arts };
}

async function gemini(prompt, { json = false, search = false } = {}) {
  const body = { contents: [{ role: 'user', parts: [{ text: prompt }] }] };
  if (json) body.generationConfig = { responseMimeType: 'application/json' };
  if (search) body.tools = [{ google_search: {} }];
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = await fetch(`${BASE}/models/${encodeURIComponent(MODEL)}:generateContent?key=${encodeURIComponent(KEY)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    if (r.status === 429 || r.status >= 500) { await new Promise(res => setTimeout(res, 15000 * attempt)); continue; }
    if (!r.ok) throw new Error('Gemini ' + r.status + ': ' + (await r.text()).slice(0, 300));
    const j = await r.json();
    return (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
  }
  throw new Error('Gemini no responde');
}

function parseEvents(text) {
  if (!text) return [];
  let t = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  const a = t.indexOf('['), o = t.indexOf('{');
  try {
    const v = JSON.parse(t);
    return Array.isArray(v) ? v : (v.eventos || v.events || []);
  } catch {
    const start = a >= 0 && (o < 0 || a < o) ? a : -1;
    if (start >= 0) {
      const end = t.lastIndexOf(']');
      try { return JSON.parse(t.slice(start, end + 1)); } catch { return []; }
    }
    return [];
  }
}

const RULES = `Hoy es ${today}. Busca eventos que se celebren en la ciudad de Teruel o en pueblos de la provincia de Teruel (España) entre ${today} y ${limit}.
Incluye conciertos, teatro, fiestas, ferias, exposiciones, charlas, presentaciones, actividades deportivas abiertas al público, mercados, rutas, cine y similares.
Solo incluye un evento si la fecha está clara. No inventes nada: si un dato no aparece, déjalo vacío.
Devuelve una lista JSON. Cada evento con estos campos:
- "title": nombre corto del evento, en español
- "date": fecha de inicio, formato AAAA-MM-DD
- "end": fecha de fin si dura varios días (AAAA-MM-DD), o vacío
- "time": hora de inicio HH:MM, o vacío
- "place": lugar (sala, plaza, pueblo…)
- "zona": "ciudad" si es en Teruel capital, "provincia" si es en otro pueblo de la provincia
- "cat": una de Fiestas, Música, Teatro, Danza, Cine, Arte, Charlas, Ferias, Deporte, Congresos, Infantil, Otros
- "desc": una o dos frases con lo esencial (precio si se sabe), máximo 200 caracteres
- "source": nombre del medio o web de donde sale
- "url": enlace a la noticia o página del evento`;

function clean(e, fallbackSource) {
  if (!e || typeof e !== 'object') return null;
  const title = String(e.title || '').trim().slice(0, 140);
  const date = String(e.date || '').slice(0, 10);
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  let end = String(e.end || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end) || end <= date) end = '';
  if ((end || date) < today || date > limit) return null;
  let time = String(e.time || '').trim();
  if (!/^\d{1,2}:\d{2}$/.test(time)) time = '';
  else time = time.padStart(5, '0');
  const url = /^https?:\/\//.test(e.url || '') ? String(e.url) : '';
  const zona = e.zona === 'provincia' ? 'provincia' : 'ciudad';
  const out = { id: slug(title) + '-' + date, title, date, place: String(e.place || '').trim().slice(0, 120), zona, cat: String(e.cat || 'Otros').slice(0, 30), desc: String(e.desc || '').trim().slice(0, 240), source: String(e.source || fallbackSource || '').slice(0, 80), url };
  if (end) out.end = end;
  if (time) out.time = time;
  return out;
}

async function main() {
  if (!KEY) { console.error('Falta el secreto GEMINI_API_KEY. Añádelo en Settings > Secrets and variables > Actions.'); process.exit(1); }

  let old = [];
  try { old = JSON.parse(await fs.readFile(OUT, 'utf8')).eventos || []; } catch { }

  const found = [];
  // 1) A partir de las webs y noticias leídas
  const { pages, arts } = await collect();
  if (pages.length || arts.length) {
    const blocks = [
      ...pages.map((p, i) => `### WEB ${i + 1}: ${p.source} (${p.url})\n${p.text}`),
      ...arts.map((a, i) => `### NOTICIA ${i + 1}: ${a.source} (${a.url})\n${a.title}\n${a.text}`)
    ].join('\n\n').slice(0, 400000);
    try {
      const txt = await gemini(`${RULES}\n\nUsa solo la información de estos textos. En "url" pon el enlace del bloque de donde sale el evento.\nResponde con un objeto JSON {"eventos": [...]}.\n\n${blocks}`, { json: true });
      const list = parseEvents(txt);
      console.log('Gemini (webs):', list.length, 'eventos');
      found.push(...list);
    } catch (e) { console.log('Fallo al extraer de las webs:', e.message); }
  }
  // 2) Búsqueda en Google desde Gemini
  try {
    const txt = await gemini(`${RULES}\n\nBusca en Google: agendas culturales, periódicos de Teruel, webs de ayuntamientos y redes sociales públicas. Responde solo con la lista JSON, sin texto antes ni después.`, { search: true });
    const list = parseEvents(txt);
    console.log('Gemini (búsqueda):', list.length, 'eventos');
    found.push(...list);
  } catch (e) { console.log('Fallo en la búsqueda:', e.message); }

  // 3) Juntar con lo anterior, sin duplicados ni eventos pasados
  const byKey = new Map();
  const add = (e, prefer) => {
    const c = clean(e);
    if (!c) return;
    const k = norm(c.title).slice(0, 40) + '|' + c.date;
    const prev = byKey.get(k);
    if (!prev || prefer) byKey.set(k, prev ? { ...prev, ...Object.fromEntries(Object.entries(c).filter(([, v]) => v)) , id: prev.id } : c);
  };
  old.forEach(e => add(e, false));
  found.forEach(e => add(e, true));
  const eventos = [...byKey.values()].sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : (a.time || '99').localeCompare(b.time || '99')).slice(0, 200);
  // ids únicos
  const seen = new Set();
  for (const e of eventos) { let id = e.id, n = 2; while (seen.has(id)) id = e.id + '-' + n++; e.id = id; seen.add(id); }

  await fs.writeFile(OUT, JSON.stringify({ updatedAt: today, eventos }, null, 1) + '\n');
  console.log(`Guardados ${eventos.length} eventos (${found.length} encontrados hoy)`);
}

main().catch(e => { console.error(e); process.exit(1); });
