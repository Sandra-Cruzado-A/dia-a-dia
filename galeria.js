/* Galería: ordena las fotos del móvil en álbumes con fecha según tus viajes y eventos de Día a día.
   Fase 1: viajes y eventos. Nunca borra nada: solo mueve fotos entre carpetas (cada carpeta es un álbum). */
(function () {
'use strict';
const W = typeof window !== 'undefined' ? window : globalThis;
const A = () => W.DIA || {};

/* ---------- utilidades ---------- */
const p2 = n => String(n).padStart(2, '0');
const dayOf = ms => { const d = new Date(ms); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
const dnum = s => { const a = s.split('-').map(Number); return Math.round(Date.UTC(a[0], a[1] - 1, a[2]) / 864e5); };
const dstr = n => { const d = new Date(n * 864e5); return d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate()); };
const nrm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtN = n => Number(n).toLocaleString('es-ES');
const fotos = n => fmtN(n) + (n === 1 ? ' foto' : ' fotos');
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fechaLarga = s => { const [y, m, d] = s.split('-').map(Number); return d + ' de ' + MESES[m - 1] + ' de ' + y; };
const rango = (a, b) => a === b ? fechaLarga(a) : fechaLarga(a).replace(/ de \d{4}$/, a.slice(0, 4) === b.slice(0, 4) ? '' : ' de ' + a.slice(0, 4)) + ' al ' + fechaLarga(b);
function km(a, b) { const R = 6371, t = Math.PI / 180; const dLa = (b.lat - a.lat) * t, dLo = (b.lon - a.lon) * t; const x = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})\s+/;
const FILE_DATE = /(?:^|\D)((?:19|20)\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?=\D|$)/;
const cleanName = s => String(s || '').replace(/[\/\\:*?"<>|\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
const lastSeg = rel => { const p = rel.replace(/\/+$/, '').split('/'); return p[p.length - 1] || rel; };
const parentOf = rel => { const p = rel.replace(/\/+$/, '').split('/'); p.pop(); return p.length ? p.join('/') + '/' : ''; };

/* ---------- qué es cada carpeta ---------- */
const CATS = [
  ['fuente', 'Fotos sueltas: se reparten'],
  ['fecha', 'Viaje o evento'],
  ['personas', 'Personas'],
  ['notocar', 'No tocar'],
  ['nueva', 'Sin clasificar']
];
const CAT_LABEL = Object.fromEntries(CATS);
const RULE_EXACT = {
  'yo': 'personas', 'familia': 'personas', '+': 'personas', 'felix': 'personas', '~': 'personas',
  'giea': 'notocar', 'erasmus': 'notocar', 'dcim': 'notocar', 'screenshots': 'notocar', 'capturas de pantalla': 'notocar',
  'tfm': 'fecha', 'instagram': 'fuente', 'camera': 'fuente', 'download': 'fuente'
};
const RULE_PREFIX = [
  ['amigos maste', 'personas'], ['rocio y samu', 'personas'],
  ['giea extra', 'notocar'], ['l.m. y piano', 'notocar'], ['elson space', 'notocar'], ['photo editor', 'notocar'], ['inshot', 'notocar'],
  ['collage', 'notocar'], ['flirone', 'notocar'], ['foto ai', 'notocar'], ['editor de video', 'notocar'], ['video editor', 'notocar'],
  ['grabaciones', 'notocar'], ['screen recordings', 'notocar'], ['calendario', 'notocar'],
  ['erasmus fotos', 'fecha'], ['mallorca', 'fecha'], ['asturias', 'fecha'], ['ginebra', 'fecha'], ['lisboa', 'fecha'], ['puy du fou', 'fecha'],
  ['budapest', 'fecha'], ['cuenca', 'fecha'], ['glasgow', 'fecha'], ['salamanca', 'fecha'], ['huesca', 'fecha'], ['crucero', 'fecha'],
  ['esqui', 'fecha'], ['graduacion', 'fecha'], ['defensa tfg', 'fecha'], ['fin de master', 'fecha'], ['premio extrao', 'fecha'],
  ['celebracion', 'fecha'], ['boda carlos', 'fecha'], ['la vaquilla', 'fecha'], ['fiestas del pilar', 'fecha'], ['medieval', 'fecha'],
  ['nochevieja', 'fecha'], ['fallas', 'fecha'], ['curso de dron', 'fecha']
];
function classifyFolder(f) {
  const lr = f.rel.toLowerCase(), n = nrm(f.name);
  if (lr.includes('whatsapp/media/')) {
    if (/\/(sent|private)\/$/.test(lr)) return 'notocar';
    if (/whatsapp (images|video)\/$/.test(lr)) return 'fuente';
    return 'notocar';
  }
  if (lr === 'dcim/camera/') return 'fuente';
  if (lr === 'download/' || lr === 'downloads/') return 'fuente';
  if (lr === 'dcim/') return 'notocar';
  if (DATE_PREFIX.test(f.name)) return 'fecha';
  if (RULE_EXACT[n]) return RULE_EXACT[n];
  for (const [p, c] of RULE_PREFIX) if (n.startsWith(p)) return c;
  return 'nueva';
}

/* ---------- fecha de cada foto ---------- */
function mediaDay(it) {
  if (it.taken > 946684800000) return dayOf(it.taken);
  const m = FILE_DATE.exec(it.name);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  if (it.mod > 0) return dayOf(it.mod * 1000);
  return null;
}

/* ---------- prepara lo leído del móvil ---------- */
function prepare(raw) {
  const media = [], folders = new Map();
  for (const r of raw) {
    const it = { id: r[0], t: r[1], vol: r[2], rel: r[3], name: r[4], taken: r[5] || 0, mod: r[6] || 0, size: r[7] || 0, w: r[8] || 0, h: r[9] || 0 };
    it.day = mediaDay(it);
    it.dn = it.day ? dnum(it.day) : null;
    it.fk = it.vol + ':' + it.rel;
    const i = media.push(it) - 1;
    let f = folders.get(it.fk);
    if (!f) { f = { fk: it.fk, vol: it.vol, rel: it.rel, name: lastSeg(it.rel), parent: parentOf(it.rel), idx: [] }; f.auto = classifyFolder(f); folders.set(it.fk, f); }
    f.idx.push(i);
  }
  return { media, folders };
}

/* ---------- el plan: qué se mueve y adónde ---------- */
function baseName(name) { return (name.replace(DATE_PREFIX, '').trim()) || name; }
function stripYear(base, date) { const y = date.slice(0, 4); const b = base.replace(new RegExp('\\s*\\(?' + y + '\\)?$'), '').trim(); return b || base; }
function groupKey(base) { return nrm(base).replace(/\s*\(?[2-9]\)?$/, ''); }

function clusters(media, idx, gap) {
  const list = idx.filter(i => media[i].dn != null).sort((a, b) => media[a].dn - media[b].dn);
  const out = [];
  let cur = null;
  for (const i of list) {
    const d = media[i].dn;
    if (!cur || d - cur.b > gap) { cur = { a: d, b: d, idx: [] }; out.push(cur); }
    cur.b = d; cur.idx.push(i);
  }
  return out;
}

function buildPlan(D) {
  const { media, folders, cfg } = D;
  const todayN = dnum(D.today);
  const cat = fk => (cfg.cats && cfg.cats[fk]) || folders.get(fk).auto;
  const albums = [];
  const byFk = new Map();

  // carpeta para los álbumes nuevos: donde están casi todos tus álbumes
  const pc = {};
  for (const f of folders.values()) { const c = cat(f.fk); if ((c === 'fecha' || c === 'personas') && f.parent) pc[f.parent] = (pc[f.parent] || 0) + 1; }
  const defParent = Object.keys(pc).sort((a, b) => pc[b] - pc[a])[0] || 'DCIM/';
  const defVol = (() => { const vc = {}; for (const f of folders.values()) vc[f.vol] = (vc[f.vol] || 0) + f.idx.length; return Object.keys(vc).sort((a, b) => vc[b] - vc[a])[0] || 'external_primary'; })();

  // 1. tus álbumes de viajes y eventos: fechas y años distintos
  for (const f of folders.values()) {
    if (cat(f.fk) !== 'fecha' || !f.idx.length) continue;
    const cl = clusters(media, f.idx, 30);
    if (!cl.length) continue;
    const dated = cl.reduce((s, c) => s + c.idx.length, 0);
    let main = cl.filter(c => c.idx.length >= Math.max(5, 0.05 * dated));
    if (!main.length) main = [cl.slice().sort((a, b) => b.idx.length - a.idx.length)[0]];
    main.sort((a, b) => b.idx.length - a.idx.length);
    main.forEach(c => {
      const runs = clusters(media, c.idx, 2);
      let q = runs.filter(r => r.idx.length >= Math.max(3, 0.05 * c.idx.length));
      if (!q.length) q = [runs.slice().sort((a, b) => b.idx.length - a.idx.length)[0]];
      c.runs = q.map(r => [r.a, r.b]);
      c.start = Math.min(...q.map(r => r.a));
    });
    const splitIdx = new Set();
    main.slice(1).forEach(c => c.idx.forEach(i => splitIdx.add(i)));
    const prim = main[0];
    const fixed = DATE_PREFIX.exec(f.name);
    const al = { id: 'f:' + f.fk, kind: 'existing', fk: f.fk, vol: f.vol, parent: f.parent, base: baseName(f.name), cl: prim, ranges: prim.runs.slice(), date: dstr(prim.start), count: f.idx.length - splitIdx.size, adds: [], keep: fixed ? fixed[1] + '-' + fixed[2] + '-' + fixed[3] : null };
    albums.push(al); byFk.set(f.fk, al);
    main.slice(1).forEach(c => albums.push({ id: 's:' + f.fk + ':' + dstr(c.start), kind: 'split', fk: f.fk, vol: f.vol, parent: f.parent, base: baseName(f.name), cl: c, ranges: c.runs.slice(), date: dstr(c.start), count: c.idx.length, idx: c.idx, adds: [], primary: al }));
  }

  // 2. viajes y eventos de Día a día: mandan sobre las fechas
  const items = D.items || [];
  for (const al of albums) {
    let best = null, bestScore = 0;
    const own = nrm(stripYear(al.base, al.date));
    for (const it of items) {
      const inside = al.cl.idx.filter(i => media[i].dn >= it.a && media[i].dn <= it.b);
      const frac = inside.length / al.cl.idx.length;
      if (frac < 0.3) continue;
      const cover = new Set(inside.map(i => media[i].dn)).size / (it.b - it.a + 1);
      const title = nrm(it.title);
      const same = !!(own && title && (own.includes(title) || title.includes(own)));
      if (!same && cover < 0.25) continue;
      const score = (same ? 2 : 0) + frac;
      if (score > bestScore || (score === bestScore && best && (it.b - it.a) > (best.b - best.a))) { best = it; bestScore = score; }
    }
    if (best) { al.link = best; al.date = best.date; al.ranges = [[best.a, best.b]]; }
    if (al.keep) al.date = al.keep;
  }

  // 3. «Budapest» y «Budapest 2» del mismo viaje: un solo álbum
  const groups = new Map();
  for (const al of albums) { const k = al.vol + '|' + groupKey(stripYear(al.base, al.date)); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(al); }
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    g.sort((a, b) => b.count - a.count);
    for (let i = 1; i < g.length; i++) {
      const b = g[i];
      if (b.kind !== 'existing') continue;
      const a = g.find(x => x !== b && !x.mergeInto && x.kind === 'existing' && (Math.max(x.cl.a, b.cl.a) - Math.min(x.cl.b, b.cl.b)) <= 30);
      if (!a || a === b) continue;
      b.mergeInto = a;
      a.ranges = a.ranges.concat(b.ranges);
      if (b.cl.a < a.cl.a && !a.link) a.date = b.date < a.date ? b.date : a.date;
      a.count += b.count;
      if (/\s*\(?[2-9]\)?$/.test(a.base) && !/\s*\(?[2-9]\)?$/.test(b.base)) a.base = b.base;
    }
  }

  // 4. viajes y eventos sin álbum todavía: álbum nuevo
  const linked = new Set(albums.filter(a => a.link && !a.mergeInto).map(a => a.link.id));
  for (const it of items) {
    if (linked.has(it.id)) continue;
    albums.push({ id: 'n:' + it.id, kind: 'new', vol: defVol, parent: defParent, base: cleanName(it.title) || (it.kind === 'viaje' ? 'Viaje' : 'Evento'), date: it.date, ranges: [[it.a, it.b]], count: 0, adds: [], link: it });
  }

  // nombres finales
  const names = cfg.names || {};
  for (const al of albums) {
    const custom = names[al.id] ? cleanName(names[al.id]) : '';
    if (al.keep && !custom) { al.label = al.base; al.finalName = folders.get(al.fk).name; }
    else { al.label = custom || stripYear(al.base, al.date); al.finalName = al.date + ' ' + al.label; }
    al.finalRel = al.parent + al.finalName + '/';
  }

  // 5. personas: «~» se junta con «Félix»
  const pmerges = [];
  const merge = Object.assign({}, cfg.merge || {});
  const felix = [...folders.values()].find(f => nrm(f.name) === 'felix');
  const tilde = [...folders.values()].find(f => f.name === '~');
  if (tilde && felix && !(tilde.fk in merge)) merge[tilde.fk] = felix.fk;
  for (const [src, dst] of Object.entries(merge)) {
    const fs = folders.get(src), fd = folders.get(dst);
    if (fs && fd && dst && src !== dst && fs.idx.length) pmerges.push({ src: fs, dst: fd });
  }

  // 6. las fotos sueltas van al álbum más concreto que cubre su día
  const live = albums.filter(a => !a.mergeInto);
  const byDay = new Map();
  for (const al of live) for (const [a, b] of al.ranges) for (let d = a; d <= Math.min(b, todayN); d++) { if (!byDay.has(d)) byDay.set(d, []); byDay.get(d).push([al, b - a]); }
  const sig = new Map();
  const sigOf = al => {
    if (sig.has(al)) return sig.get(al);
    const s = new Set();
    const fks = al.fk ? [al.fk].concat(albums.filter(x => x.mergeInto === al).map(x => x.fk)) : [];
    for (const fk of fks) for (const i of folders.get(fk).idx) s.add(media[i].name + '|' + media[i].size);
    sig.set(al, s); return s;
  };
  const loose = [], unassigned = [], dups = [];
  for (const f of folders.values()) {
    if (cat(f.fk) !== 'fuente') continue;
    for (const i of f.idx) {
      const it = media[i];
      if (it.dn == null || it.dn > todayN) continue;
      loose.push(i);
      const c = byDay.get(it.dn);
      if (!c) { unassigned.push(i); continue; }
      c.sort((x, y) => x[1] - y[1] || y[0].count - x[0].count);
      const al = c[0][0];
      if (sigOf(al).has(it.name + '|' + it.size)) { dups.push(i); continue; }
      al.adds.push(i);
    }
  }

  // 7. eventos con muchas fotos: ¿álbum?
  const looseByDay = new Map();
  for (const i of loose) looseByDay.set(media[i].dn, (looseByDay.get(media[i].dn) || 0) + 1);
  const evSug = [];
  for (const e of D.eventCands || []) {
    const n = looseByDay.get(dnum(e.date)) || 0;
    if (n >= 8) evSug.push({ id: e.id, title: e.title, date: e.date, count: n });
  }
  evSug.sort((a, b) => a.date < b.date ? 1 : -1);

  // 8. fotos lejos de casa sin viaje apuntado
  const homes = D.homes || [];
  const far = [];
  for (const i of unassigned) {
    const it = media[i];
    if (it.t !== 1) continue;
    const g = D.gps && D.gps.get(it.vol + ':' + it.id);
    if (!g) continue;
    const p = { lat: g[0], lon: g[1] };
    if (homes.every(h => km(h, p) > (h.radio || 50))) far.push({ dn: it.dn, p });
  }
  far.sort((a, b) => a.dn - b.dn);
  const tripSug = [];
  let cur = null;
  for (const x of far) {
    if (!cur || x.dn - cur.b > 1) { cur = { a: x.dn, b: x.dn, pts: [] }; tripSug.push(cur); }
    cur.b = x.dn; cur.pts.push(x.p);
  }
  const dismissed = new Set(cfg.dismissed || []);
  const trips = tripSug.filter(t => t.pts.length >= 5).map(t => {
    const la = t.pts.map(p => p.lat).sort((a, b) => a - b), lo = t.pts.map(p => p.lon).sort((a, b) => a - b);
    const m = Math.floor(la.length / 2);
    const pk = la[m].toFixed(2) + ',' + lo[m].toFixed(2);
    return { key: dstr(t.a) + '_' + dstr(t.b), from: dstr(t.a), to: dstr(t.b), count: t.pts.length, lat: la[m], lon: lo[m], name: (cfg.places || {})[pk] || '' };
  }).filter(t => !dismissed.has(t.key));

  // 9. lista de cambios
  const ops = [];
  const splitByFk = new Map();
  for (const al of albums) if (al.kind === 'split') { if (!splitByFk.has(al.fk)) splitByFk.set(al.fk, []); splitByFk.get(al.fk).push(al); }
  for (const al of albums) {
    if (al.kind !== 'existing' || al.mergeInto) continue;
    const f = folders.get(al.fk);
    if (f.name !== al.finalName) ops.push({ k: 'ren:' + al.fk, type: 'rename', album: al, fk: al.fk, idx: f.idx });
  }
  for (const al of albums) if (al.kind === 'split') ops.push({ k: 'spl:' + al.id, type: 'split', album: al, fk: al.fk, idx: al.idx });
  for (const al of albums) if (al.kind === 'existing' && al.mergeInto) {
    const f = folders.get(al.fk);
    const out = new Set((splitByFk.get(al.fk) || []).flatMap(s => s.idx));
    ops.push({ k: 'mrg:' + al.fk, type: 'merge', album: al, into: al.mergeInto, fk: al.fk, idx: f.idx.filter(i => !out.has(i)) });
  }
  for (const pm of pmerges) ops.push({ k: 'pmg:' + pm.src.fk, type: 'pmerge', src: pm.src, dst: pm.dst, fk: pm.src.fk, idx: pm.src.idx });
  for (const al of albums) if (!al.mergeInto && al.adds.length) ops.push({ k: (al.kind === 'new' ? 'new:' : 'add:') + al.id, type: al.kind === 'new' ? 'new' : 'add', album: al, idx: al.adds });

  return { albums, ops, loose, unassigned, dups, evSug, trips, defParent };
}

/* ---------- de los cambios marcados a la lista de fotos que se mueven ---------- */
function isOn(plan, cfg, k) { return !(cfg.off && cfg.off[k]); }
function albumRel(plan, cfg, al, folders) {
  if (!al) return null;
  if (al.mergeInto) return albumRel(plan, cfg, al.mergeInto, folders);
  if (al.kind === 'existing') return isOn(plan, cfg, 'ren:' + al.fk) && folders.get(al.fk).name !== al.finalName ? al.finalRel : folders.get(al.fk).rel;
  if (al.kind === 'split' && !isOn(plan, cfg, 'spl:' + al.id)) return albumRel(plan, cfg, al.primary, folders);
  return al.finalRel;
}
function emptiedFolders(plan, cfg, data) {
  const out = new Map();
  for (const op of plan.ops) if (['rename', 'merge', 'pmerge'].includes(op.type) && isOn(plan, cfg, op.k)) { const f = data.folders.get(op.fk); out.set(f.fk, { vol: f.vol, rel: f.rel }); }
  return out;
}
function computeMoves(plan, cfg, data) {
  const { media, folders } = data;
  const dest = new Map();
  const order = ['rename', 'split', 'merge', 'pmerge', 'add', 'new'];
  for (const type of order) {
    for (const op of plan.ops) {
      if (op.type !== type || !isOn(plan, cfg, op.k)) continue;
      let to;
      if (type === 'rename') to = albumRel(plan, cfg, op.album, folders);
      else if (type === 'split') to = op.album.finalRel;
      else if (type === 'merge') to = albumRel(plan, cfg, op.into, folders);
      else if (type === 'pmerge') to = op.dst.rel;
      else to = albumRel(plan, cfg, op.album, folders);
      for (const i of op.idx) dest.set(i, to);
    }
  }
  const out = [];
  for (const [i, to] of dest) if (to && media[i].rel !== to) out.push({ i, to });
  return out;
}

/* ---------- estado ---------- */
const G = { stage: 'idle', status: null, data: null, plan: null, cfg: null, gps: new Map(), prog: null, confirm: null, result: null, err: '', thumbs: new Map(), showFolders: false, busy: false };
const P = () => A().plug ? A().plug('Galeria') : null;
async function loadCfg() {
  if (G.cfg) return G.cfg;
  const c = (A().kvGet && await A().kvGet('galeria')) || {};
  G.cfg = Object.assign({ cats: {}, off: {}, names: {}, merge: {}, dismissed: [], homes: [], places: {} }, c);
  return G.cfg;
}
function saveCfg() { if (A().kvSet && G.cfg) A().kvSet('galeria', JSON.parse(JSON.stringify(G.cfg))); }
function homes() {
  const H = A().HOME || { name: 'Teruel', lat: 40.3441, lon: -1.1093 };
  return [{ name: H.name, lat: H.lat, lon: H.lon }].concat(G.cfg.homes || []);
}
function readItems(today) {
  const S = A().S, out = [], cands = [];
  if (!S) return { items: out, cands };
  for (const e of S.entries.values()) {
    if (!e || !e.date || !e.title || e.date > today) continue;
    if (e.kind === 'viaje') {
      const end = e.end && e.end >= e.date ? e.end : e.date;
      out.push({ id: e.id, kind: 'viaje', title: e.title, date: e.date, end, a: dnum(e.date), b: dnum(end) });
    } else if (e.kind === 'evento' && (!e.repeat || e.repeat === 'none') && !e.teruelId) {
      if (e.album === true) out.push({ id: e.id, kind: 'evento', title: e.title, date: e.date, end: e.date, a: dnum(e.date), b: dnum(e.date) });
      else if (e.album === undefined) cands.push({ id: e.id, title: e.title, date: e.date });
    }
  }
  return { items: out, cands };
}
function today() { return A().todayStr ? A().todayStr() : dayOf(Date.now()); }
function replan() {
  if (!G.data) return;
  const t = today();
  const r = readItems(t);
  G.plan = buildPlan({ media: G.data.media, folders: G.data.folders, cfg: G.cfg, today: t, items: r.items, eventCands: r.cands, homes: homes(), gps: G.gps });
}
function rerender() { const S = A().S; if (S && S.view === 'mas' && S.mas === 'galeria' && A().renderMas) A().renderMas(); }
function setProg(text, done, total) {
  G.prog = { text, done, total };
  const bar = document.getElementById('gal-prog'), tx = document.getElementById('gal-ptx');
  if (bar && tx) { bar.style.width = (total ? Math.round(100 * done / total) : 0) + '%'; tx.textContent = text; }
  else rerender();
}

/* ---------- permisos ---------- */
async function refreshStatus() {
  const p = P();
  if (!p) { G.status = { none: true }; return; }
  try { G.status = await p.status(); } catch (_) { G.status = { none: true }; }
}

/* ---------- analizar ---------- */
async function scan() {
  if (G.busy) return;
  const p = P(); if (!p) return;
  G.busy = true; G.err = ''; G.result = null; G.confirm = null;
  await loadCfg();
  try {
    G.stage = 'scanning'; setProg('Leyendo tu galería…', 0, 0);
    if (G.status && !G.status.location) { try { await p.requestMedia(); } catch (_) {} await refreshStatus(); }
    const r = await p.scan();
    G.data = prepare(r.items || []);
    G.data.roots = r.roots || {};
    const cache = (A().kvGet && await A().kvGet('galeria-gps')) || {};
    G.gps = new Map();
    for (const it of G.data.media) { const c = cache[it.vol + ':' + it.id + ':' + it.mod]; if (c) G.gps.set(it.vol + ':' + it.id, c); }
    replan();
    const need = G.plan.unassigned.map(i => G.data.media[i]).filter(it => it.t === 1 && !((it.vol + ':' + it.id + ':' + it.mod) in cache));
    G.stage = 'gps';
    for (let k = 0; k < need.length; k += 60) {
      setProg('Mirando dónde se hicieron las fotos sin álbum… ' + fmtN(Math.min(k + 60, need.length)) + ' de ' + fmtN(need.length), k, need.length);
      const batch = need.slice(k, k + 60);
      let res = { items: [] };
      try { res = await p.gps({ items: batch.map(it => ({ id: it.id, vol: it.vol })) }); } catch (_) {}
      const got = new Map((res.items || []).map(a => [a[0], [a[1], a[2]]]));
      for (const it of batch) {
        const v = got.get(it.id) || 0;
        cache[it.vol + ':' + it.id + ':' + it.mod] = v;
        if (v) G.gps.set(it.vol + ':' + it.id, v);
      }
    }
    if (A().kvSet) await A().kvSet('galeria-gps', cache);
    replan();
    G.stage = 'ready';
    G.busy = false;
    rerender();
    nameTrips();
  } catch (e) {
    G.stage = 'idle'; G.busy = false; G.err = 'No se ha podido leer la galería. ' + ((e && e.message) || '');
    rerender();
  }
}
async function nameTrips() {
  if (!G.plan) return;
  for (const t of G.plan.trips) {
    const k = t.lat.toFixed(2) + ',' + t.lon.toFixed(2);
    if (G.cfg.places[k]) { t.name = G.cfg.places[k]; continue; }
    try {
      const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 8000);
      const r = await fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&accept-language=es&lat=' + t.lat + '&lon=' + t.lon, { signal: ctl.signal });
      clearTimeout(to);
      const j = await r.json(); const a = j.address || {};
      const n = a.city || a.town || a.village || a.municipality || a.county || a.state || j.name || '';
      if (n) { G.cfg.places[k] = n; t.name = n; saveCfg(); rerender(); }
    } catch (_) {}
    await sleep(1100);
  }
}

/* ---------- aplicar y deshacer ---------- */
async function apply() {
  if (G.busy || !G.plan) return;
  const p = P(); if (!p) return;
  const moves = computeMoves(G.plan, G.cfg, G.data);
  if (!moves.length) { G.confirm = null; rerender(); return; }
  G.busy = true; G.confirm = null; G.stage = 'applying';
  const log = { at: Date.now(), moves: [] };
  let ok = 0, fail = 0;
  const srcDirs = emptiedFolders(G.plan, G.cfg, G.data);
  for (let k = 0; k < moves.length; k += 40) {
    setProg('Moviendo fotos… ' + fmtN(Math.min(k + 40, moves.length)) + ' de ' + fmtN(moves.length), k, moves.length);
    const batch = moves.slice(k, k + 40).map(m => { const it = G.data.media[m.i]; return { id: it.id, type: it.t, vol: it.vol, to: m.to }; });
    let res = { results: [] };
    try { res = await p.move({ items: batch }); } catch (_) {}
    (res.results || []).forEach((r, j) => {
      const b = batch[j];
      if (r && r.ok && r.from !== r.to) { ok++; log.moves.push({ id: r.newId, type: b.type, vol: b.vol, from: r.from, name: r.name, to: r.to, newName: r.newName }); }
      else if (!(r && r.ok)) fail++;
    });
    fail += Math.max(0, batch.length - (res.results || []).length);
    if (A().kvSet) await A().kvSet('galeria-log', log);
  }
  await clean(srcDirs);
  G.result = { ok, fail, undo: false };
  G.stage = 'done'; G.busy = false; G.data = null; G.plan = null;
  G.cfg.lastRun = { at: log.at, ok, fail }; saveCfg();
  rerender();
}
async function clean(dirs) {
  const p = P(); if (!p || !dirs.size) return;
  if (G.data && G.data.roots) { G.cfg.roots = G.data.roots; saveCfg(); }
  const roots = G.cfg.roots || {};
  const list = [...dirs.values()].filter(d => roots[d.vol] && !/^(dcim\/camera|download)\/$/i.test(d.rel) && !/whatsapp/i.test(d.rel)).map(d => ({ root: roots[d.vol], rel: d.rel }));
  try { if (list.length) await p.cleanEmpty({ dirs: list }); } catch (_) {}
}
async function undo() {
  if (G.busy) return;
  const p = P(); if (!p) return;
  const log = A().kvGet && await A().kvGet('galeria-log');
  if (!log || !log.moves || !log.moves.length) { G.confirm = null; rerender(); return; }
  G.busy = true; G.confirm = null; G.stage = 'applying';
  const moves = log.moves.slice().reverse();
  let ok = 0, fail = 0;
  const dirs = new Map();
  for (let k = 0; k < moves.length; k += 40) {
    setProg('Dejando las fotos como estaban… ' + fmtN(Math.min(k + 40, moves.length)) + ' de ' + fmtN(moves.length), k, moves.length);
    const batch = moves.slice(k, k + 40).map(m => ({ id: m.id, type: m.type, vol: m.vol, to: m.from, name: m.name }));
    let res = { results: [] };
    try { res = await p.move({ items: batch }); } catch (_) {}
    (res.results || []).forEach((r, j) => { if (r && r.ok) { ok++; dirs.set(batch[j].vol + ':' + moves[k + j].to, { vol: batch[j].vol, rel: moves[k + j].to }); } else fail++; });
  }
  await clean(dirs);
  if (A().kvSet) await A().kvSet('galeria-log', null);
  G.result = { ok, fail, undo: true };
  G.stage = 'done'; G.busy = false; G.data = null; G.plan = null;
  G.cfg.lastRun = null; saveCfg();
  rerender();
}

/* ---------- pantalla ---------- */
const CHECK = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7"/></svg>';
function injectCSS() {
  if (document.getElementById('gal-css')) return;
  const s = document.createElement('style'); s.id = 'gal-css';
  s.textContent = `.galop{display:flex;gap:12px;align-items:flex-start;padding:12px 0;border-top:1px solid var(--line)}.galop:first-of-type{border-top:0}
.galck{flex:none;width:28px;height:28px;border-radius:9px;border:1.5px solid var(--line-2);background:var(--surface);display:grid;place-items:center;color:transparent;padding:0;margin-top:1px}
.galck[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}
.galop .tx .t,.galrow .tx .t{white-space:normal}.galop .tx .m,.galrow .tx .m{white-space:normal}
.gth{display:flex;gap:5px;margin-top:8px}.gth img{width:54px;height:54px;object-fit:cover;border-radius:9px;background:var(--sunk);display:block}
.galrow{display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid var(--line)}.galrow:first-of-type{border-top:0}
.galsel{height:40px;font-size:14px;width:auto;max-width:48%;flex:none;padding:0 8px}
.galsum{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}.galsum div{background:var(--sunk);border-radius:14px;padding:10px 12px}.galsum b{display:block;font-size:21px;font-variant-numeric:tabular-nums}.galsum span{font-size:12.5px;color:var(--muted)}
.galedit{border:0;background:none;color:var(--muted);font-size:13px;padding:4px 0;text-decoration:underline;margin-top:2px}
.galh{font-size:13.5px;color:var(--muted);font-weight:600;margin:18px 2px 0;text-transform:none}
.galbtns{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.galbtns .sec,.galbtns .pri{height:38px;font-size:13.5px;padding:0 12px}`;
  document.head.appendChild(s);
}
function srcSummary(idx) {
  const c = {};
  for (const i of idx) { const f = G.data.folders.get(G.data.media[i].fk); const n = /whatsapp/i.test(f.rel) ? 'WhatsApp' : /^dcim\/camera\/$/i.test(f.rel) ? 'Cámara' : /^download/i.test(f.rel) ? 'Descargas' : f.name; c[n] = (c[n] || 0) + 1; }
  return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([n, v]) => n + ' ' + fmtN(v)).join(', ');
}
function thumbsHTML(idx) {
  const pick = idx.length <= 4 ? idx : [idx[0], idx[Math.floor(idx.length / 3)], idx[Math.floor(2 * idx.length / 3)], idx[idx.length - 1]];
  return '<div class="gth">' + pick.map(i => { const it = G.data.media[i]; const k = it.vol + ':' + it.id; const u = G.thumbs.get(k); return `<img alt="" ${u ? `src="${u}"` : `data-galth="${esc(k)}" data-t="${it.t}"`}>`; }).join('') + '</div>';
}
function opRow(op) {
  const on = isOn(G.plan, G.cfg, op.k);
  const F = G.data.folders;
  let t = '', m = '', edit = false;
  const q = s => '«' + esc(s) + '»';
  if (op.type === 'rename') {
    const f = F.get(op.fk);
    t = `${q(f.name)} pasa a llamarse ${q(op.album.finalName)}`;
    m = fotos(f.idx.length) + (op.album.link ? `. Fecha de tu ${op.album.link.kind === 'viaje' ? 'viaje' : 'evento'} en Día a día.` : '');
    edit = true;
  } else if (op.type === 'split') {
    const f = F.get(op.fk);
    t = `Separar de ${q(f.name)} las fotos de ${op.album.date.slice(0, 4)} en ${q(op.album.finalName)}`;
    m = fotos(op.idx.length) + ' de otro año.';
    edit = true;
  } else if (op.type === 'merge') {
    const f = F.get(op.fk);
    const to = albumRel(G.plan, G.cfg, op.into, F);
    t = `Juntar ${q(f.name)} con ${q(lastSeg(to))}`;
    m = fotos(op.idx.length) + ' del mismo viaje.';
  } else if (op.type === 'pmerge') {
    t = `Juntar ${q(op.src.name)} con ${q(op.dst.name)}`;
    m = fotos(op.idx.length) + '.';
  } else if (op.type === 'add') {
    const to = albumRel(G.plan, G.cfg, op.album, F);
    t = `Añadir ${fotos(op.idx.length)} a ${q(lastSeg(to))}`;
    m = 'Desde ' + srcSummary(op.idx) + '.';
  } else {
    const L = op.album.link;
    t = `Crear ${q(op.album.finalName)} con ${fotos(op.idx.length)}`;
    m = (L.kind === 'viaje' ? 'Viaje' : 'Evento') + ' de Día a día, ' + rango(L.date, L.end) + '. Desde ' + srcSummary(op.idx) + '.';
    edit = true;
  }
  return `<div class="galop"><button class="galck" data-gal="op" data-k="${esc(op.k)}" aria-pressed="${on}" aria-label="Hacer este cambio">${CHECK}</button><div class="tx"><span class="t">${t}</span><span class="m">${m}</span>${edit ? `<button class="galedit" data-gal="name" data-id="${esc(op.album.id)}">Cambiar el nombre</button>` : ''}${thumbsHTML(op.idx)}</div></div>`;
}
function masGaleria() {
  injectCSS();
  const back = A().backHTML ? A().backHTML() : '';
  let h = back + `<h1 class="title t2">Galería</h1><p class="sub" style="margin-top:8px">Ordena tus fotos en álbumes con fecha según tus viajes y eventos. Primero ves los cambios y eliges cuáles hacer. Nunca se borra ninguna foto.</p>`;
  if (!(A().isNative && A().isNative())) return h + `<section class="card"><p class="sub">Esto solo funciona en la app de Android.</p></section>`;
  if (!G.status) { refreshStatus().then(rerender); return h + `<section class="card"><p class="sub">Comprobando permisos…</p></section>`; }
  const st = G.status;
  if (st.none) return h + `<section class="card"><p class="sub">Falta instalar la versión nueva de la app (APK) para usar la galería.</p></section>`;
  if (st.sdk < 30) return h + `<section class="card"><p class="sub">Hace falta Android 11 o más nuevo.</p></section>`;
  if (!st.allFiles) {
    return h + `<section class="card"><h2>Un permiso antes de empezar</h2><p class="sub">Para mover fotos entre álbumes, Android pide que actives «Permitir acceso para gestionar todos los archivos» para Día a día. Se activa una vez.</p><div class="btnrow"><button class="pri" data-gal="perm">Abrir el permiso</button><button class="sec" data-gal="recheck">Ya lo he activado</button></div></section>`;
  }
  if (G.err) h += `<p class="err">${esc(G.err)}</p>`;
  if (G.stage === 'scanning' || G.stage === 'gps' || G.stage === 'applying') {
    const pr = G.prog || { text: '', done: 0, total: 0 };
    return h + `<section class="card"><p class="sub" id="gal-ptx">${esc(pr.text)}</p><span class="prog"><i id="gal-prog" style="width:${pr.total ? Math.round(100 * pr.done / pr.total) : 0}%"></i></span><p class="sub" style="margin-top:10px">No cierres la app hasta que termine.</p></section>`;
  }
  if (G.stage === 'done' && G.result) {
    const r = G.result;
    h += `<section class="card"><h2>${r.undo ? 'Hecho: todo está como antes' : 'Hecho'}</h2><p class="sub">${r.undo ? fotos(r.ok) + ' han vuelto a su carpeta.' : fotos(r.ok) + ' están ya en su álbum.'}${r.fail ? ' ' + fotos(r.fail) + ' no se han podido mover y siguen donde estaban.' : ''}</p><div class="btnrow"><button class="pri" data-gal="scan">Volver a analizar</button>${!r.undo ? `<button class="sec" data-gal="undo">Deshacer</button>` : ''}</div>${G.confirm === 'undo' ? confirmHTML('undo') : ''}</section>`;
    return h;
  }
  if (G.stage !== 'ready' || !G.plan) {
    const lr = G.cfg && G.cfg.lastRun;
    h += `<section class="card"><h2>Analizar la galería</h2><p class="sub">Lee las fechas de tus fotos y las compara con tus viajes y eventos. Tarda un poco la primera vez.</p><div class="btnrow"><button class="pri" data-gal="scan">Analizar</button>${lr ? `<button class="sec" data-gal="undo">Deshacer la última vez</button>` : ''}</div>${G.confirm === 'undo' ? confirmHTML('undo') : ''}</section>`;
    if (!G.cfg) loadCfg().then(rerender);
    return h;
  }
  const pl = G.plan, F = G.data.folders;
  const cat = fk => G.cfg.cats[fk] || F.get(fk).auto;
  const moves = computeMoves(pl, G.cfg, G.data);
  const assigned = pl.ops.filter(o => o.type === 'add' || o.type === 'new').reduce((s, o) => s + o.idx.length, 0);
  h += `<div class="galsum"><div><b>${fmtN(G.data.media.length)}</b><span>fotos y vídeos</span></div><div><b>${fmtN(pl.loose.length)}</b><span>sueltas en Cámara, WhatsApp y Descargas</span></div><div><b>${fmtN(assigned)}</b><span>de esas tienen álbum de viaje o evento</span></div><div><b>${fmtN(pl.unassigned.length)}</b><span>son del día a día (fase 2)</span></div></div>`;

  const nuevas = [...F.values()].filter(f => cat(f.fk) === 'nueva');
  if (nuevas.length) {
    h += `<p class="galh">Carpetas que no conozco</p><section class="card" style="margin-top:8px"><p class="sub">No se tocan hasta que digas qué son.</p>${nuevas.map(folderRow).join('')}</section>`;
  }
  if (pl.evSug.length) {
    h += `<p class="galh">Eventos con muchas fotos</p><section class="card" style="margin-top:8px"><p class="sub">¿Les hago álbum? Lo que elijas se queda guardado en el evento.</p>${pl.evSug.map(e => `<div class="galrow"><span class="tx"><span class="t">${esc(e.title)}</span><span class="m">${esc(fechaLarga(e.date))}, ${fotos(e.count)}</span></span><span class="galbtns" style="margin:0;flex:none"><button class="pri" data-gal="ev" data-id="${esc(e.id)}" data-v="1">Sí</button><button class="sec" data-gal="ev" data-id="${esc(e.id)}" data-v="0">No</button></span></div>`).join('')}</section>`;
  }
  if (pl.trips.length) {
    h += `<p class="galh">Fotos lejos de Teruel sin viaje apuntado</p><section class="card" style="margin-top:8px"><p class="sub">Si fue un viaje, apúntalo y sus fotos irán a su álbum. Si es un sitio al que vas a menudo, márcalo como otra casa y no te lo volveré a proponer.</p>${pl.trips.map(t => `<div class="galrow" style="flex-wrap:wrap"><span class="tx"><span class="t">${esc(t.name || 'Lejos de casa')}</span><span class="m">${esc(rango(t.from, t.to))}, ${fotos(t.count)}</span></span><span class="galbtns" style="width:100%;margin-top:6px"><button class="pri" data-gal="trip" data-k="${esc(t.key)}">Apuntar viaje</button><button class="sec" data-gal="home" data-k="${esc(t.key)}">Es otra casa</button><button class="sec" data-gal="dismiss" data-k="${esc(t.key)}">Ignorar</button></span></div>`).join('')}</section>`;
  }
  const groupsOps = [
    ['Tus álbumes', pl.ops.filter(o => ['rename', 'split', 'merge', 'pmerge'].includes(o.type))],
    ['Fotos sueltas a sus álbumes', pl.ops.filter(o => o.type === 'add')],
    ['Álbumes nuevos', pl.ops.filter(o => o.type === 'new')]
  ].filter(g => g[1].length);
  if (!groupsOps.length) h += `<section class="card"><h2>Todo en orden</h2><p class="sub">No hay nada que mover en viajes y eventos.</p></section>`;
  for (const [title, list] of groupsOps) h += `<p class="galh">${esc(title)}</p><section class="card" style="margin-top:8px">${list.map(opRow).join('')}</section>`;

  h += `<p class="galh">Todas las carpetas</p><section class="card" style="margin-top:8px"><p class="sub">Así he entendido cada carpeta. Cámbialo si algo no cuadra.</p>`;
  if (G.showFolders) h += [...F.values()].sort((a, b) => a.name.localeCompare(b.name, 'es')).map(folderRow).join('') + `<div class="btnrow"><button class="sec" data-gal="folders">Ocultar</button></div>`;
  else h += `<div class="btnrow"><button class="sec" data-gal="folders">Ver las ${fmtN(F.size)} carpetas</button></div>`;
  h += `</section>`;

  h += `<section class="card"><p class="sub">${moves.length ? `Con lo marcado se mueven ${fotos(moves.length)}. No se borra ninguna, y puedes deshacerlo después.` : 'No hay nada marcado.'}</p><div class="btnrow"><button class="pri" data-gal="apply" ${moves.length ? '' : 'disabled'}>Aplicar los cambios</button><button class="sec" data-gal="scan">Volver a analizar</button>${G.cfg.lastRun ? `<button class="sec" data-gal="undo">Deshacer la última vez</button>` : ''}</div>${G.confirm === 'apply' ? confirmHTML('apply', moves.length) : ''}${G.confirm === 'undo' ? confirmHTML('undo') : ''}</section>`;
  setTimeout(loadThumbs, 0);
  return h;
}
function confirmHTML(kind, n) {
  if (kind === 'apply') return `<div class="galbtns" style="margin-top:12px"><span class="sub" style="width:100%;margin:0">¿Muevo ${fotos(n)} ahora?</span><button class="pri" data-gal="apply-yes">Sí, moverlas</button><button class="sec" data-gal="cancel">Cancelar</button></div>`;
  return `<div class="galbtns" style="margin-top:12px"><span class="sub" style="width:100%;margin:0">¿Devuelvo las fotos de la última vez a donde estaban?</span><button class="pri" data-gal="undo-yes">Sí, deshacer</button><button class="sec" data-gal="cancel">Cancelar</button></div>`;
}
function folderRow(f) {
  const c = G.cfg.cats[f.fk] || f.auto;
  return `<div class="galrow"><span class="tx"><span class="t">${esc(f.name)}</span><span class="m">${fotos(f.idx.length)}</span></span><select class="field galsel" data-galcat="${esc(f.fk)}">${CATS.map(([k, l]) => `<option value="${k}"${k === c ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div>`;
}
let thumbBusy = false;
async function loadThumbs() {
  if (thumbBusy) return;
  const p = P(); if (!p) return;
  thumbBusy = true;
  try {
    for (;;) {
      const img = document.querySelector('img[data-galth]');
      if (!img) break;
      const k = img.dataset.galth, t = +img.dataset.t || 1;
      img.removeAttribute('data-galth');
      let u = G.thumbs.get(k);
      if (!u) {
        const [vol, id] = [k.slice(0, k.lastIndexOf(':')), +k.slice(k.lastIndexOf(':') + 1)];
        try { const r = await p.thumb({ id, type: t, vol, size: 160 }); u = 'data:image/jpeg;base64,' + r.data; G.thumbs.set(k, u); } catch (_) { u = ''; }
      }
      if (u) img.src = u;
    }
  } finally { thumbBusy = false; }
}

/* ---------- toques ---------- */
function tripByKey(k) { return G.plan && G.plan.trips.find(t => t.key === k); }
async function onClick(ev) {
  const b = ev.target.closest && ev.target.closest('[data-gal]');
  if (!b) return;
  const d = b.dataset, act = d.gal;
  if (act === 'perm') { try { await P().openAllFiles(); } catch (_) {} return; }
  if (act === 'recheck') { await refreshStatus(); rerender(); return; }
  if (act === 'scan') { scan(); return; }
  if (act === 'apply') { G.confirm = 'apply'; rerender(); return; }
  if (act === 'apply-yes') { apply(); return; }
  if (act === 'undo') { G.confirm = 'undo'; rerender(); return; }
  if (act === 'undo-yes') { undo(); return; }
  if (act === 'cancel') { G.confirm = null; rerender(); return; }
  if (act === 'folders') { G.showFolders = !G.showFolders; rerender(); return; }
  if (act === 'op') { G.cfg.off[d.k] = !G.cfg.off[d.k]; if (!G.cfg.off[d.k]) delete G.cfg.off[d.k]; saveCfg(); rerender(); return; }
  if (act === 'name') {
    const al = G.plan && G.plan.albums.find(a => a.id === d.id); if (!al) return;
    const v = W.prompt('Nombre del álbum (la fecha se pone sola delante)', al.label);
    if (v == null) return;
    const n = cleanName(v);
    if (n) G.cfg.names[al.id] = n; else delete G.cfg.names[al.id];
    saveCfg(); replan(); rerender(); return;
  }
  if (act === 'ev') {
    const S = A().S, e = S && S.entries.get(d.id); if (!e) return;
    A().persist(Object.assign({}, e, { album: d.v === '1' }), true);
    replan(); rerender(); return;
  }
  if (act === 'trip') {
    const t = tripByKey(d.k); if (!t) return;
    const e = { id: A().newId(), kind: 'viaje', title: t.name || 'Viaje', date: t.from, end: t.to, budget: null, created: Date.now() };
    A().persist(e, true);
    try { if (A().linkTripEntries) A().linkTripEntries(e); if (A().queueGeo) A().queueGeo(e.id); } catch (_) {}
    if (A().toast) A().toast('Viaje apuntado en Día a día');
    replan(); rerender(); return;
  }
  if (act === 'home') {
    const t = tripByKey(d.k); if (!t) return;
    G.cfg.homes.push({ name: t.name || 'Otra casa', lat: t.lat, lon: t.lon, radio: 30 });
    saveCfg(); replan(); rerender(); return;
  }
  if (act === 'dismiss') { G.cfg.dismissed.push(d.k); saveCfg(); replan(); rerender(); return; }
}
function onChange(ev) {
  const s = ev.target;
  if (!s || !s.dataset || !s.dataset.galcat) return;
  const f = G.data && G.data.folders.get(s.dataset.galcat);
  if (!f) return;
  if (s.value === f.auto) delete G.cfg.cats[f.fk]; else G.cfg.cats[f.fk] = s.value;
  saveCfg(); replan(); rerender();
}

if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('click', ev => { onClick(ev).catch(() => {}); });
  document.addEventListener('change', onChange);
  document.addEventListener('visibilitychange', () => {
    const S = A().S;
    if (!document.hidden && S && S.view === 'mas' && S.mas === 'galeria' && !G.busy) refreshStatus().then(rerender);
  });
}

W.masGaleria = masGaleria;
W.GaleriaCore = { classifyFolder, mediaDay, prepare, buildPlan, computeMoves, albumRel, dnum, dstr };
})();
