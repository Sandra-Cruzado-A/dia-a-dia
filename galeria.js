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
const deL = s => s.length === 7 ? 'de ' + MESES[+s.slice(5, 7) - 1] + ' de ' + s.slice(0, 4) : 'del ' + fechaLarga(s);
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
  ['capturas', 'Capturas: a su viaje o a Para borrar'],
  ['notocar', 'No tocar'],
  ['nueva', 'Sin clasificar']
];
const CAT_LABEL = Object.fromEntries(CATS);
const RULE_EXACT = {
  'yo': 'personas', 'familia': 'personas', '+': 'personas', 'felix': 'personas', '~': 'personas',
  'giea': 'notocar', 'erasmus': 'notocar', 'dcim': 'notocar', 'screenshots': 'capturas', 'capturas de pantalla': 'capturas', 'para borrar': 'notocar', 'revisar': 'notocar',
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

/* ---------- caras: huellas, grupos y a qué álbum va cada persona ---------- */
const FQ = 250;
function encD(d) { let s = ''; for (let i = 0; i < 128; i++) { const v = Math.max(-127, Math.min(127, Math.round(d[i] * FQ))); s += String.fromCharCode(v & 255); } return (typeof btoa === 'function' ? btoa : x => Buffer.from(x, 'binary').toString('base64'))(s); }
function decD(b64) { const bin = (typeof atob === 'function' ? atob : x => Buffer.from(x, 'base64').toString('binary'))(b64); const f = new Float32Array(128); for (let i = 0; i < 128; i++) { let v = bin.charCodeAt(i); if (v > 127) v -= 256; f[i] = v / FQ; } return f; }
function fdist(a, b) { let s = 0; for (let i = 0; i < 128; i++) { const x = a[i] - b[i]; s += x * x; } return Math.sqrt(s); }
function clusterFaces(list, T, M) {
  T = T || 0.5; M = M || 0.42;
  const cl = [];
  for (let i = 0; i < list.length; i++) {
    const d = list[i].d;
    let best = -1, bd = T;
    for (let j = 0; j < cl.length; j++) { const x = fdist(d, cl[j].c); if (x < bd) { bd = x; best = j; } }
    if (best < 0) cl.push({ sum: Float32Array.from(d), c: Float32Array.from(d), n: 1, m: [i] });
    else { const c = cl[best]; c.n++; for (let q = 0; q < 128; q++) { c.sum[q] += d[q]; c.c[q] = c.sum[q] / c.n; } c.m.push(i); }
  }
  let merged = true;
  while (merged) {
    merged = false;
    for (let a = 0; a < cl.length; a++) {
      if (!cl[a]) continue;
      for (let b = a + 1; b < cl.length; b++) {
        if (!cl[b] || fdist(cl[a].c, cl[b].c) >= M) continue;
        const A = cl[a], B = cl[b];
        A.n += B.n; for (let q = 0; q < 128; q++) { A.sum[q] += B.sum[q]; A.c[q] = A.sum[q] / A.n; }
        A.m = A.m.concat(B.m); cl[b] = null; merged = true;
      }
    }
  }
  // segunda pasada: caras sueltas (pequeñas o de lado) que se parecen claramente a alguien conocido
  const big = cl.filter(c => c && c.n >= 2);
  for (const c of cl) {
    if (!c || c.n !== 1) continue;
    const d = list[c.m[0]].d;
    let b1 = 9, b2 = 9, best = null;
    for (const g of big) {
      let m = 9;
      const step = Math.max(1, Math.floor(g.m.length / 40));
      for (let q = 0; q < g.m.length; q += step) { const x = fdist(d, list[g.m[q]].d); if (x < m) m = x; }
      if (m < b1) { b2 = b1; b1 = m; best = g; } else if (m < b2) b2 = m;
    }
    if (best && b1 < 0.58 && b2 - b1 >= 0.04) { best.m.push(c.m[0]); best.n++; c.gone = true; }
  }
  const out = cl.filter(c => c && !c.gone);
  out.forEach((c, k) => c.m.forEach(i => { list[i].k = k; }));
  return out;
}
/* Quién es cada grupo de caras: con las fotos de tus álbumes de personas se sugiere su álbum. */
function suggestPeople(list, cls, exCount, yoFk) {
  const sug = cls.map(() => ({ album: 'no', photos: new Set(), ex: new Map() }));
  list.forEach(f => { const s = sug[f.k]; s.photos.add(f.pk); if (f.ex) { if (!s.ex.has(f.ex)) s.ex.set(f.ex, new Set()); s.ex.get(f.ex).add(f.pk); } });
  const frac = (s, a) => (s.ex.get(a) ? s.ex.get(a).size : 0) / Math.max(1, exCount.get(a) || 0);
  let yoMax = 0;
  if (yoFk && (exCount.get(yoFk) || 0) >= 2) sug.forEach(s => { yoMax = Math.max(yoMax, frac(s, yoFk)); });
  sug.forEach(s => {
    if (yoMax >= 0.3 && frac(s, yoFk) >= 0.6 * yoMax) { s.album = 'yo'; return; }
    let best = null, bf = 0;
    for (const [a, set] of s.ex) { if (a === yoFk || set.size < 2) continue; const f = frac(s, a); if (f >= 0.1 && f > bf) { bf = f; best = a; } }
    if (best) s.album = best;
  });
  if (!(yoMax >= 0.3)) {
    let bi = -1, bn = 0;
    sug.forEach((s, k) => { let n = 0; for (const set of s.ex.values()) n += set.size; if (n > bn) { bn = n; bi = k; } });
    let tot = 0; for (const v of exCount.values()) tot += v;
    if (bi >= 0 && bn >= 0.4 * tot) sug[bi].album = 'yo';
  }
  return sug;
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
  const decl = cfg.decl || {}, np = cfg.np || {}, names = cfg.names || {};
  const cat0 = fk => (cfg.cats && cfg.cats[fk]) || folders.get(fk).auto;
  const albums = [];
  const byFk = new Map();

  // carpeta para los álbumes nuevos: donde están casi todos tus álbumes
  const pc = {};
  for (const f of folders.values()) { const c = cat0(f.fk); if ((c === 'fecha' || c === 'personas') && f.parent) pc[f.parent] = (pc[f.parent] || 0) + 1; }
  const defParent = Object.keys(pc).sort((a, b) => pc[b] - pc[a])[0] || 'DCIM/';
  const trashRel = defParent + ((names.trash && cleanName(names.trash)) || 'Para borrar') + '/';
  const revRel = defParent + ((names.revisar && cleanName(names.revisar)) || 'Revisar') + '/';
  const cat = fk => { if (cfg.cats && cfg.cats[fk]) return cfg.cats[fk]; const f = folders.get(fk); return f.rel === trashRel || f.rel === revRel ? 'notocar' : f.auto; };
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
    const extra = main.slice(1).filter(c => !decl['spl:s:' + f.fk + ':' + dstr(c.start)]);
    const splitIdx = new Set();
    extra.forEach(c => c.idx.forEach(i => splitIdx.add(i)));
    const prim = main[0];
    const fixed = DATE_PREFIX.exec(f.name);
    const al = { id: 'f:' + f.fk, kind: 'existing', fk: f.fk, vol: f.vol, parent: f.parent, base: baseName(f.name), cl: prim, ranges: prim.runs.slice(), date: dstr(prim.start), count: f.idx.length - splitIdx.size, adds: [], keep: fixed ? fixed[1] + '-' + fixed[2] + '-' + fixed[3] : null };
    albums.push(al); byFk.set(f.fk, al);
    extra.forEach(c => albums.push({ id: 's:' + f.fk + ':' + dstr(c.start), kind: 'split', fk: f.fk, vol: f.vol, parent: f.parent, base: baseName(f.name), cl: c, ranges: c.runs.slice(), date: dstr(c.start), count: c.idx.length, idx: c.idx, adds: [], primary: al }));
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
      if (b.kind !== 'existing' || decl['mrg:' + b.fk]) continue;
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

  // clave estable de cada álbum (para recordar lo que descartas)
  for (const al of albums) al.key = al.link ? 'i:' + al.link.id : 'n:' + al.vol + '|' + nrm(stripYear(al.base, al.date)) + '|' + al.date.slice(0, 7);

  // nombres finales; si descartaste un nombre, se prueba otra fecha y, si no hay, se deja como está
  function nameAlbum(al) {
    const custom = names[al.id] ? cleanName(names[al.id]) : '';
    al.custom = !!custom;
    if (al.auto === 'trash') { al.label = custom || 'Para borrar'; al.finalName = al.label; }
    else if (al.auto === 'revisar') { al.label = custom || 'Revisar'; al.finalName = al.label; }
    else if (al.kind === 'people') { const f = folders.get(al.fk); al.label = f.name; al.finalName = f.name; }
    else if (al.keep && !custom) { al.label = al.base; al.finalName = folders.get(al.fk).name; }
    else if (al.kind === 'existing') {
      const fname = folders.get(al.fk).name;
      const dates = [al.date];
      if (al.link && !custom) { const alt = dstr(al.cl.start); if (alt !== al.date) dates.push(alt); }
      let chosen = null;
      for (const d of dates) { const lb = custom || stripYear(al.base, d); const n = d + ' ' + lb; if (n === fname || !decl['ren:' + al.fk + '>' + n]) { chosen = { lb, n }; break; } }
      if (chosen) { al.label = chosen.lb; al.finalName = chosen.n; }
      else { al.label = baseName(fname); al.finalName = fname; al.noRename = true; }
    } else { al.label = custom || stripYear(al.base, al.date); al.finalName = al.date + ' ' + al.label; }
    al.renKey = al.fk ? 'ren:' + al.fk + '>' + al.finalName : null;
    al.finalRel = al.parent + al.finalName + '/';
  }
  for (const al of albums) nameAlbum(al);

  // 5. personas: «~» se junta con «Félix»
  const pmerges = [];
  const merge = Object.assign({}, cfg.merge || {});
  const felix = [...folders.values()].find(f => nrm(f.name) === 'felix');
  const tilde = [...folders.values()].find(f => f.name === '~');
  if (tilde && felix && !(tilde.fk in merge)) merge[tilde.fk] = felix.fk;
  for (const [src, dst] of Object.entries(merge)) {
    const fs = folders.get(src), fd = folders.get(dst);
    if (fs && fd && dst && src !== dst && fs.idx.length && !decl['pmg:' + src]) pmerges.push({ src: fs, dst: fd });
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
      const pk = it.vol + ':' + it.id;
      const hit = c.find(x => !np[pk + '>' + x[0].key]);
      if (!hit) { unassigned.push(i); continue; }
      const al = hit[0];
      if (sigOf(al).has(it.name + '|' + it.size)) { dups.push(i); continue; }
      al.adds.push(i);
    }
  }

  // 7. álbumes que crea la app: viajes que no apuntaste y días con muchas fotos de la cámara
  const pool = unassigned.slice();
  const homes = D.homes || [];
  const dismissed = new Set(cfg.dismissed || []);
  const H = D.hints || {};
  const places = cfg.places || {};
  const isWA = i => /whatsapp/i.test(media[i].rel);
  const gpsOf = i => D.gps && D.gps.get(media[i].vol + ':' + media[i].id);
  const median = pts => { const la = pts.map(p => p.lat).sort((a, b) => a - b), lo = pts.map(p => p.lon).sort((a, b) => a - b), m = Math.floor(la.length / 2); return { lat: la[m], lon: lo[m] }; };
  const placeOf = p => places[p.lat.toFixed(2) + ',' + p.lon.toFixed(2)] || '';
  const hintsOf = dn => { const ds = dstr(dn); return { ev: (H.events || {})[ds] || [], bd: (H.bdays || {})[ds.slice(5)] || [] }; };
  const taken = new Set();
  const mkAuto = (kind, a, b, members, extra) => {
    const key = (kind === 'far' ? 'g:' : 'd:') + defVol + '|' + dstr(a) + '_' + dstr(b);
    const adds = members.filter(i => !np[media[i].vol + ':' + media[i].id + '>' + key]);
    if (!adds.length) return null;
    const al = Object.assign({ id: key, key, kind: 'new', auto: kind, vol: defVol, parent: defParent, date: dstr(a), ranges: [[a, b]], count: adds.length, adds }, extra);
    nameAlbum(al); albums.push(al);
    adds.forEach(i => taken.add(i));
    return al;
  };
  // a) lejos de casa sin viaje apuntado
  const farPts = [];
  for (const i of pool) { if (media[i].t !== 1) continue; const g = gpsOf(i); if (!g) continue; const p = { lat: g[0], lon: g[1] }; if (homes.every(h => km(h, p) > (h.radio || 50))) farPts.push({ dn: media[i].dn, p }); }
  farPts.sort((x, y) => x.dn - y.dn);
  const farCl = [];
  let cur = null;
  for (const x of farPts) { if (!cur || x.dn - cur.b > 1) { cur = { a: x.dn, b: x.dn, pts: [] }; farCl.push(cur); } cur.b = x.dn; cur.pts.push(x.p); }
  for (const t of farCl) {
    const tk = dstr(t.a) + '_' + dstr(t.b);
    if (t.pts.length < 5 || dismissed.has(tk)) continue;
    const c = median(t.pts), place = placeOf(c);
    mkAuto('far', t.a, t.b, pool.filter(i => media[i].dn >= t.a && media[i].dn <= t.b && !taken.has(i)), { base: place || 'Viaje', place, lat: c.lat, lon: c.lon, trip: { key: tk, from: dstr(t.a), to: dstr(t.b), lat: c.lat, lon: c.lon, count: t.pts.length } });
  }
  // b) días con muchas fotos de la cámara (con evento o cumpleaños en Día a día basta con menos)
  const camDay = new Map();
  for (const i of pool) { if (taken.has(i) || isWA(i)) continue; const d = media[i].dn; if (!camDay.has(d)) camDay.set(d, []); camDay.get(d).push(i); }
  const busy = [...camDay.keys()].filter(d => {
    const h = hintsOf(d);
    if (h.ev.length && h.ev.every(e => e.no)) return false;
    return camDay.get(d).length >= (h.ev.some(e => !e.no) || h.bd.length ? 6 : 12);
  }).sort((x, y) => x - y);
  const busyCl = [];
  cur = null;
  for (const d of busy) { if (!cur || d - cur.b > 1) { cur = { a: d, b: d }; busyCl.push(cur); } cur.b = d; }
  for (const t of busyCl) {
    const members = [];
    for (let d = t.a; d <= t.b; d++) members.push(...(camDay.get(d) || []));
    let ev = '', bd = '';
    for (let d = t.a; d <= t.b; d++) { const h = hintsOf(d); if (!ev) ev = (h.ev.find(e => !e.no) || {}).title || ''; if (!bd) bd = h.bd[0] || ''; }
    const pts = members.map(gpsOf).filter(Boolean).map(g => ({ lat: g[0], lon: g[1] }));
    const c = pts.length ? median(pts) : null;
    const away = !!(c && homes.every(h => km(h, c) > 15));
    const place = away ? placeOf(c) : '';
    mkAuto('busy', t.a, t.b, members, { base: cleanName(ev) || bd || place || 'Evento', place, lat: away ? c.lat : null, lon: away ? c.lon : null, hint: ev || bd || '' });
  }
  const rest = unassigned.filter(i => !taken.has(i));
  unassigned.length = 0;
  unassigned.push(...rest);

  // 8. capturas de pantalla: las de un viaje van a su álbum; el resto, a «Para borrar», donde decides tú
  const caps = [];
  const trash = { id: 'trash', key: 'trash', kind: 'new', auto: 'trash', vol: defVol, parent: defParent, base: 'Para borrar', date: '', ranges: [], count: 0, adds: [] };
  nameAlbum(trash);
  const capDay = new Map();
  for (const al of albums) {
    if (al.mergeInto || al.auto === 'busy') continue;
    const trip = al.auto === 'far' || (al.link && al.link.kind === 'viaje') || al.ranges.some(r => r[1] > r[0]);
    if (!trip) continue;
    for (const [a, b] of al.ranges) for (let d = a; d <= Math.min(b, todayN); d++) { if (!capDay.has(d)) capDay.set(d, []); capDay.get(d).push([al, b - a]); }
  }
  for (const f of folders.values()) {
    if (cat(f.fk) !== 'capturas') continue;
    for (const i of f.idx) {
      const it = media[i];
      if (it.dn == null || it.dn > todayN) continue;
      caps.push(i);
      const pk = it.vol + ':' + it.id;
      const hit = (capDay.get(it.dn) || []).slice().sort((x, y) => x[1] - y[1]).find(x => !np[pk + '>' + x[0].key]);
      if (hit) hit[0].adds.push(i);
      else if (!np[pk + '>trash']) trash.adds.push(i);
      else unassigned.push(i);
    }
  }
  if (trash.adds.length) { trash.count = trash.adds.length; albums.push(trash); }

  // 9. caras: cada foto del día a día va al álbum de las personas que salen
  //    una sola persona o grupo → su álbum; varios que tienen orden (Familia, +, Félix) → el primero; si no → «Revisar»
  //    tú no cuentas para el cruce; si solo sales tú (o con desconocidos) → «Yo»
  if (D.faces && D.personAlbum) {
    const prio = (D.prio || []).filter(fk => folders.has(fk));
    const peopleAl = new Map();
    const pAlbum = fk => {
      if (!peopleAl.has(fk)) { const f = folders.get(fk); const al = { id: 'p:' + fk, key: 'p:' + fk, kind: 'people', fk, vol: f.vol, parent: f.parent, base: f.name, date: '', ranges: [], count: f.idx.length, adds: [] }; nameAlbum(al); peopleAl.set(fk, al); }
      return peopleAl.get(fk);
    };
    const rev = { id: 'revisar', key: 'revisar', kind: 'new', auto: 'revisar', vol: defVol, parent: defParent, base: 'Revisar', date: '', ranges: [], count: 0, adds: [] };
    nameAlbum(rev);
    const left = [];
    let noFace = 0, strangers = 0;
    for (const i of unassigned) {
      const it = media[i], pk = it.vol + ':' + it.id;
      const ps = D.faces.get(pk);
      if (!ps) { left.push(i); continue; }
      if (!ps.length) { noFace++; left.push(i); continue; }
      const S = new Set();
      let yo = false;
      for (const p of ps) { const a = p ? D.personAlbum.get(p) : null; if (a === 'yo') yo = true; else if (a && a !== 'no' && folders.has(a)) S.add(D.mergeTo && D.mergeTo[a] ? D.mergeTo[a] : a); }
      let target = null;
      if (S.size === 1) target = [...S][0];
      else if (S.size > 1) target = [...S].every(a => prio.includes(a)) ? prio.find(a => S.has(a)) : 'revisar';
      else if (yo && D.yoFk && folders.has(D.yoFk)) target = D.yoFk;
      if (!target) { strangers++; left.push(i); continue; }
      const al = target === 'revisar' ? rev : pAlbum(target);
      if (np[pk + '>' + al.key]) { left.push(i); continue; }
      al.adds.push(i);
    }
    unassigned.length = 0;
    unassigned.push(...left);
    for (const al of peopleAl.values()) if (al.adds.length) albums.push(al);
    if (rev.adds.length) { rev.count = rev.adds.length; albums.push(rev); }
    var faceStats = { noFace, strangers };
  }

  // 9. lista de cambios
  const ops = [];
  const splitByFk = new Map();
  for (const al of albums) if (al.kind === 'split') { if (!splitByFk.has(al.fk)) splitByFk.set(al.fk, []); splitByFk.get(al.fk).push(al); }
  for (const al of albums) {
    if (al.kind !== 'existing' || al.mergeInto) continue;
    const f = folders.get(al.fk);
    if (f.name !== al.finalName) ops.push({ k: al.renKey, type: 'rename', album: al, fk: al.fk, idx: f.idx });
  }
  for (const al of albums) if (al.kind === 'split') ops.push({ k: 'spl:' + al.id, type: 'split', album: al, fk: al.fk, idx: al.idx });
  for (const al of albums) if (al.kind === 'existing' && al.mergeInto) {
    const f = folders.get(al.fk);
    const out = new Set((splitByFk.get(al.fk) || []).flatMap(s => s.idx));
    ops.push({ k: 'mrg:' + al.fk, type: 'merge', album: al, into: al.mergeInto, fk: al.fk, idx: f.idx.filter(i => !out.has(i)) });
  }
  for (const pm of pmerges) ops.push({ k: 'pmg:' + pm.src.fk, type: 'pmerge', src: pm.src, dst: pm.dst, fk: pm.src.fk, idx: pm.src.idx });
  // fotos sueltas: primero en grupo; si descartas el grupo, por días; si descartas un día, foto a foto
  for (const al of albums) {
    if (al.mergeInto || !al.adds.length) continue;
    const gk = 'add:' + al.key;
    if (!decl[gk]) { ops.push({ k: gk, type: al.kind === 'new' ? 'new' : 'add', album: al, idx: al.adds }); continue; }
    const byD = new Map();
    const cut = new Set(al.adds.map(i => media[i].day)).size > 12 ? 7 : 10;
    for (const i of al.adds) { const d = media[i].day.slice(0, cut); if (!byD.has(d)) byD.set(d, []); byD.get(d).push(i); }
    const multi = byD.size > 1;
    for (const d of [...byD.keys()].sort()) {
      const dk = gk + '@' + d;
      if (multi && !decl[dk]) ops.push({ k: dk, type: 'addday', album: al, day: d, idx: byD.get(d) });
      else ops.push({ k: 'pick:' + al.key + '@' + d, type: 'pick', album: al, day: d, idx: byD.get(d) });
    }
  }

  const assigned = albums.reduce((s2, a) => s2 + (a.mergeInto ? 0 : a.adds.length), 0);
  return { albums, ops, loose, caps, pool, unassigned, dups, defParent, assigned, faceStats: typeof faceStats !== 'undefined' ? faceStats : null };
}

/* ---------- de los cambios marcados a la lista de fotos que se mueven ---------- */
function isOn(plan, cfg, k) { return !(cfg.off && cfg.off[k]); }
function albumRel(plan, cfg, al, folders) {
  if (!al) return null;
  if (al.mergeInto) return albumRel(plan, cfg, al.mergeInto, folders);
  if (al.kind === 'people') return folders.get(al.fk).rel;
  if (al.kind === 'existing') return !al.noRename && isOn(plan, cfg, al.renKey) && folders.get(al.fk).name !== al.finalName ? al.finalRel : folders.get(al.fk).rel;
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
  const order = ['rename', 'split', 'merge', 'pmerge', 'add', 'new', 'addday', 'pick'];
  const pick = cfg.pick || {};
  for (const type of order) {
    for (const op of plan.ops) {
      if (op.type !== type || !isOn(plan, cfg, op.k)) continue;
      let to;
      if (type === 'rename') to = albumRel(plan, cfg, op.album, folders);
      else if (type === 'split') to = op.album.finalRel;
      else if (type === 'merge') to = albumRel(plan, cfg, op.into, folders);
      else if (type === 'pmerge') to = op.dst.rel;
      else to = albumRel(plan, cfg, op.album, folders);
      const list = type === 'pick' ? op.idx.filter(i => pick[media[i].vol + ':' + media[i].id + '>' + op.album.key] === 1) : op.idx;
      for (const i of list) dest.set(i, to);
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
  G.cfg = Object.assign({ cats: {}, off: {}, names: {}, merge: {}, dismissed: [], homes: [], places: {}, decl: {}, np: {}, pick: {} }, c);
  return G.cfg;
}
function commitDeclines() {
  const c = G.cfg; if (!c) return;
  for (const k of Object.keys(c.off || {})) if (c.off[k]) c.decl[k] = 1;
  c.off = {};
  for (const [k, v] of Object.entries(c.pick || {})) if (v === -1) { c.np[k] = 1; delete c.pick[k]; }
  saveCfg();
}
function saveCfg() { if (A().kvSet && G.cfg) A().kvSet('galeria', JSON.parse(JSON.stringify(G.cfg))); }
function homes() {
  const H = A().HOME || { name: 'Teruel', lat: 40.3441, lon: -1.1093 };
  return [{ name: H.name, lat: H.lat, lon: H.lon }].concat(G.cfg.homes || []);
}
function readItems(today) {
  const S = A().S, out = [], cands = [], hints = { events: {}, bdays: {} };
  if (!S) return { items: out, cands, hints };
  for (const e of S.entries.values()) {
    if (e && e.kind === 'persona' && e.cumple) (hints.bdays[e.cumple] = hints.bdays[e.cumple] || []).push(e.id === 'yo' ? 'Mi cumpleaños' : 'Cumpleaños de ' + e.title);
    if (e && e.kind === 'evento' && e.date && e.title && (!e.repeat || e.repeat === 'none') && !e.teruelId) (hints.events[e.date] = hints.events[e.date] || []).push({ title: e.title, no: e.album === false });
    if (!e || !e.date || !e.title || e.date > today) continue;
    if (e.kind === 'viaje') {
      const end = e.end && e.end >= e.date ? e.end : e.date;
      out.push({ id: e.id, kind: 'viaje', title: e.title, date: e.date, end, a: dnum(e.date), b: dnum(end) });
    } else if (e.kind === 'evento' && (!e.repeat || e.repeat === 'none') && !e.teruelId) {
      if (e.album === true) out.push({ id: e.id, kind: 'evento', title: e.title, date: e.date, end: e.date, a: dnum(e.date), b: dnum(e.date) });
      else if (e.album === undefined) cands.push({ id: e.id, title: e.title, date: e.date });
    }
  }
  return { items: out, cands, hints };
}
function today() { return A().todayStr ? A().todayStr() : dayOf(Date.now()); }
function replan() {
  if (!G.data) return;
  const t = today();
  const r = readItems(t);
  G.hints = r.hints;
  const pp = G.people;
  G.plan = buildPlan({ media: G.data.media, folders: G.data.folders, cfg: G.cfg, today: t, items: r.items, eventCands: r.cands, hints: r.hints, homes: homes(), gps: G.gps,
    faces: pp ? pp.byPk : null, personAlbum: pp ? new Map((G.cfg.persons || []).map(x => [x.id, x.album])) : null, prio: pp ? pp.pf.prio : [], yoFk: pp ? pp.pf.yoFk : null, mergeTo: pp ? pp.pf.mergeTo : {} });
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
  closeV(false);
  await loadCfg();
  commitDeclines();
  G.people = null; G.faceData = null;
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
    const need = G.plan.pool.map(i => G.data.media[i]).filter(it => it.t === 1 && !((it.vol + ':' + it.id + ':' + it.mod) in cache));
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
    namePlaces();
    if (G.cfg.facesOn) analyzeFaces();
  } catch (e) {
    G.stage = 'idle'; G.busy = false; G.err = 'No se ha podido leer la galería. ' + ((e && e.message) || '');
    rerender();
  }
}
async function namePlaces() {
  if (G.placing) return;
  G.placing = true;
  try {
    for (;;) {
      if (!G.plan) break;
      const al = G.plan.albums.find(a => a.auto && a.lat != null && !a.place && !G.cfg.places[a.lat.toFixed(2) + ',' + a.lon.toFixed(2)] && !(G.noPlace || new Set()).has(a.id));
      if (!al) break;
      const k = al.lat.toFixed(2) + ',' + al.lon.toFixed(2);
      let n = '';
      try {
        const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 8000);
        const r = await fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&accept-language=es&lat=' + al.lat + '&lon=' + al.lon, { signal: ctl.signal });
        clearTimeout(to);
        const j = await r.json(); const a = j.address || {};
        n = a.city || a.town || a.village || a.municipality || a.county || a.state || j.name || '';
      } catch (_) {}
      if (n) { G.cfg.places[k] = n; saveCfg(); replan(); rerender(); }
      else { G.noPlace = G.noPlace || new Set(); G.noPlace.add(al.id); }
      await sleep(1100);
    }
  } finally { G.placing = false; }
}

/* ---------- reconocer caras dentro del móvil ---------- */
const FACE_CDN = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15';
let faceP = null;
function loadFaceApi(cb) {
  if (faceP) return faceP;
  faceP = (async () => {
    if (!W.faceapi) {
      cb && cb('Descargando el reconocimiento de caras (solo la primera vez)…');
      await new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = FACE_CDN + '/dist/face-api.js'; sc.async = true; sc.onload = res; sc.onerror = () => rej(new Error('No he podido descargar el reconocimiento de caras. La primera vez necesita internet.')); document.head.appendChild(sc); });
    }
    const fa = W.faceapi;
    try { await fa.tf.setBackend('webgl'); } catch (_) {}
    await fa.tf.ready();
    cb && cb('Cargando el reconocimiento de caras…');
    const M = FACE_CDN + '/model';
    await fa.nets.ssdMobilenetv1.loadFromUri(M);
    await fa.nets.faceLandmark68Net.loadFromUri(M);
    await fa.nets.faceRecognitionNet.loadFromUri(M);
    return fa;
  })();
  faceP.catch(() => { faceP = null; });
  return faceP;
}
function loadImg(b64) {
  return new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = () => rej(new Error('img')); img.src = 'data:image/jpeg;base64,' + b64; });
}
async function facesOf(fa, it) {
  const r = await P().thumb({ id: it.id, type: it.t, vol: it.vol, size: 720 });
  const img = await loadImg(r.data);
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  const det = await fa.detectAllFaces(img, new fa.SsdMobilenetv1Options({ minConfidence: 0.5 })).withFaceLandmarks().withFaceDescriptors();
  return det.filter(x => x.detection.box.width >= 24).map(x => ({ d: x.descriptor, b: [x.detection.box.x / w, x.detection.box.y / h, x.detection.box.width / w, x.detection.box.height / h] }));
}
function personFolders() {
  const F = G.data.folders, cat = fk => (G.cfg.cats || {})[fk] || F.get(fk).auto;
  const list = [...F.values()].filter(f => cat(f.fk) === 'personas');
  const byName = n => list.find(f => nrm(f.name) === n);
  const yo = byName('yo'), fam = byName('familia'), mas = byName('+'), fel = byName('felix'), tilde = list.find(f => f.name === '~');
  const m = Object.assign({}, G.cfg.merge || {});
  if (tilde && fel && !(tilde.fk in m)) m[tilde.fk] = fel.fk;
  const mergeTo = {};
  for (const [a, b] of Object.entries(m)) if (b && F.has(b) && !(G.cfg.decl || {})['pmg:' + a]) mergeTo[a] = b;
  return { list, yoFk: yo ? yo.fk : null, prio: [fam, mas, fel].filter(Boolean).map(f => f.fk), mergeTo };
}
function faceCandidates() {
  const keep = G.people;
  G.people = null; replan();
  const cand = G.plan.unassigned.filter(i => G.data.media[i].t === 1);
  G.people = keep; replan();
  return cand;
}
function faceExamples(pf) {
  const media = G.data.media, ex = [];
  for (const f of pf.list) {
    const imgs = f.idx.filter(i => media[i].t === 1 && media[i].dn != null).sort((a, b) => media[a].dn - media[b].dn);
    const n = Math.min(60, imgs.length);
    for (let q = 0; q < n; q++) ex.push({ i: imgs[Math.floor(q * imgs.length / n)], album: pf.mergeTo[f.fk] || f.fk });
  }
  return ex;
}
async function analyzeFaces() {
  if (G.busy || !G.data) return;
  const p = P(); if (!p) return;
  G.busy = true; G.stopFaces = false; G.err = ''; G.cfg.facesOn = true; saveCfg();
  G.stage = 'faces';
  try {
    setProg('Preparando el reconocimiento de caras…', 0, 0);
    const media = G.data.media;
    const cache = (A().kvGet && await A().kvGet('galeria-caras')) || {};
    const pf = personFolders();
    const ex = faceExamples(pf);
    const cand = faceCandidates();
    const todo = [...new Set(ex.map(x => x.i).concat(cand))].filter(i => { const e = cache[pkOf(media[i])]; return !e || e.m !== media[i].mod; });
    if (todo.length) {
      const fa = await loadFaceApi(t => setProg(t, 0, 0));
      const slow = fa.tf && fa.tf.getBackend && fa.tf.getBackend() !== 'webgl' ? ' Tu móvil no deja usar la tarjeta gráfica, así que irá más lento.' : '';
      let n = 0;
      const t0 = Date.now();
      for (const i of todo) {
        if (G.stopFaces) break;
        let eta = '';
        if (n >= 5) { const min = Math.round((Date.now() - t0) / n * (todo.length - n) / 60000); eta = min >= 1 ? ' Quedan unos ' + fmtN(min) + (min === 1 ? ' minuto.' : ' minutos.') : ' Queda menos de un minuto.'; }
        setProg('Buscando caras en tus fotos… ' + fmtN(n + 1) + ' de ' + fmtN(todo.length) + '.' + eta + slow, n, todo.length);
        const it = media[i];
        try { const r = await facesOf(fa, it); cache[pkOf(it)] = { m: it.mod, f: r.map(x => [encD(x.d)].concat(x.b.map(v => Math.round(v * 1e4) / 1e4))) }; } catch (_) {}
        n++;
        if (n % 25 === 0 && A().kvSet) await A().kvSet('galeria-caras', cache);
      }
      if (A().kvSet) await A().kvSet('galeria-caras', cache);
    }
    G.faceData = { ex, cand, cache };
    resolvePeople();
    replan();
  } catch (e) {
    G.err = (e && e.message) || 'No se han podido reconocer las caras.';
  }
  G.stage = 'ready'; G.busy = false;
  rerender();
}
function resolvePeople() {
  const fd = G.faceData;
  if (!fd || !G.data) { G.people = null; return; }
  const media = G.data.media, pf = personFolders();
  const list = [], exCount = new Map(), exPk = new Set();
  for (const x of fd.ex) {
    const pk = pkOf(media[x.i]), e = fd.cache[pk];
    if (!e || !e.f.length || exPk.has(pk)) continue;
    exPk.add(pk);
    exCount.set(x.album, (exCount.get(x.album) || 0) + 1);
    e.f.forEach(f => list.push({ pk, i: x.i, ex: x.album, d: decD(f[0]), b: f.slice(1) }));
  }
  for (const i of fd.cand) {
    const pk = pkOf(media[i]), e = fd.cache[pk];
    if (!e || exPk.has(pk)) continue;
    e.f.forEach(f => list.push({ pk, i, ex: null, d: decD(f[0]), b: f.slice(1) }));
  }
  const cls = clusterFaces(list);
  const sug = suggestPeople(list, cls, exCount, pf.yoFk);
  const stored = (G.cfg.persons || []).map(x => ({ x, c: decD(x.c) }));
  const used = new Set(), persons = [];
  cls.forEach((c, k) => {
    let best = null, bd = 0.45;
    for (const st of stored) { if (used.has(st.x.id)) continue; const v = fdist(c.c, st.c); if (v < bd) { bd = v; best = st; } }
    const n = sug[k].photos.size;
    if (!best && n < 2) { persons.push(null); return; }
    const per = best ? Object.assign({}, best.x) : { id: 'q' + Date.now().toString(36) + k, src: 'auto' };
    if (best) used.add(per.id);
    per.c = encD(c.c); per.n = n; per.k = k;
    if (per.src !== 'user') per.album = sug[k].album;
    persons.push(per);
  });
  const keepUser = (G.cfg.persons || []).filter(x => !used.has(x.id) && x.src === 'user');
  G.cfg.persons = persons.filter(Boolean).map(x => ({ id: x.id, c: x.c, album: x.album, src: x.src, n: x.n, crop: x.crop || '' })).concat(keepUser).slice(0, 400);
  saveCfg();
  const byPk = new Map();
  for (const i of fd.cand) { const pk = pkOf(media[i]); if (fd.cache[pk]) byPk.set(pk, []); }
  list.forEach(f => { if (f.ex || !byPk.has(f.pk)) return; const per = persons[f.k]; byPk.get(f.pk).push(per ? per.id : null); });
  G.people = { list, cls, persons: persons.filter(Boolean), byPk, pf };
}
async function cropFace(per) {
  if (!G.people) return '';
  const fs = G.people.cls[per.k] ? G.people.cls[per.k].m.map(i => G.people.list[i]) : [];
  if (!fs.length) return '';
  const f = fs.slice().sort((a, b) => (b.b[2] || 0) - (a.b[2] || 0))[0];
  const it = G.data.media[f.i];
  const r = await P().thumb({ id: it.id, type: it.t, vol: it.vol, size: 720 });
  const img = await loadImg(r.data);
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  const [x, y, bw, bh] = f.b, m = 0.3;
  const sx = Math.max(0, (x - bw * m) * w), sy = Math.max(0, (y - bh * m) * h), sw = Math.min(w - sx, bw * (1 + 2 * m) * w), sh = Math.min(h - sy, bh * (1 + 2 * m) * h);
  const cv = document.createElement('canvas'); cv.width = 96; cv.height = 96;
  const ctx = cv.getContext && cv.getContext('2d'); if (!ctx) return '';
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 96, 96);
  return cv.toDataURL('image/jpeg', 0.8);
}
let cropBusy = false;
async function loadCrops() {
  if (cropBusy || !G.people) return;
  cropBusy = true;
  try {
    for (;;) {
      const img = document.querySelector('img[data-galface]');
      if (!img) break;
      const id = img.dataset.galface; img.removeAttribute('data-galface');
      const per = G.people.persons.find(x => x.id === id); if (!per) continue;
      let u = '';
      try { u = await cropFace(per); } catch (_) {}
      if (u) {
        img.src = u; per.crop = u;
        const st = (G.cfg.persons || []).find(x => x.id === id); if (st) { st.crop = u; saveCfg(); }
      }
    }
  } finally { cropBusy = false; }
}

/* ---------- aplicar y deshacer ---------- */
async function apply() {
  if (G.busy || !G.plan) return;
  const p = P(); if (!p) return;
  closeV(false);
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
  commitDeclines();
  for (const [k, v] of Object.entries(G.cfg.pick)) if (v === 1) delete G.cfg.pick[k];
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
.galppl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px 8px;margin-top:12px}
.galp{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;min-width:0}
.galface{width:72px;height:72px;border-radius:50%;overflow:hidden;background:var(--sunk);display:block}.galface img{width:100%;height:100%;object-fit:cover;display:block}
.galp .m{font-size:12.5px;color:var(--muted)}.galp .galsel{max-width:100%;width:100%;height:36px;font-size:13px}
.galname{margin-top:10px;display:flex;flex-direction:column;gap:8px}.galname .chips{margin-top:0}.galname .chip{height:34px;font-size:13.5px}
.galbtns{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.galbtns .sec,.galbtns .pri{height:38px;font-size:13.5px;padding:0 12px}
.gth{align-items:center}.gth button{padding:0;border:0;background:none;border-radius:9px}.gth .gall{margin:0 0 0 4px}
.galpick .tx{width:100%}
.galgrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;margin-top:10px}
.galcell{position:relative}
.galcell .galimg{display:block;width:100%;padding:0;border:0;background:var(--sunk);border-radius:9px;overflow:hidden;aspect-ratio:1/1}
.galcell .galimg img{width:100%;height:100%;object-fit:cover;display:block}
.galcell.no .galimg{opacity:.35}
.galmark{position:absolute;top:4px;right:4px;width:28px;height:28px;border-radius:50%;border:1.5px solid #fff;background:rgba(0,0,0,.35);color:transparent;display:grid;place-items:center;padding:0}
.galmark[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}
.galcell .nox,.galcell .vidx{position:absolute;left:5px;bottom:5px;font-size:11.5px;font-weight:700;color:#fff;background:rgba(0,0,0,.6);border-radius:6px;padding:1px 6px}
.galcell .vidx{left:auto;right:5px}
.galv{position:fixed;inset:0;z-index:3000;background:#000;display:flex;flex-direction:column;color:#fff}
.galv[hidden]{display:none}
.galv-top{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:calc(env(safe-area-inset-top,0px) + 10px) 14px 8px}
.galv-top .n{font-size:14px;opacity:.85}
.galv-x{width:42px;height:42px;border-radius:50%;border:0;background:rgba(255,255,255,.16);color:#fff;font-size:24px;line-height:1}
.galv-stage{flex:1;min-height:0;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;touch-action:none}
.galv-stage img{max-width:100%;max-height:100%;object-fit:contain;transform-origin:center center;user-select:none;-webkit-user-drag:none}
.galv-nav{position:absolute;top:50%;transform:translateY(-50%);width:44px;height:64px;border:0;border-radius:12px;background:rgba(0,0,0,.4);color:#fff;font-size:30px;line-height:1}
.galv-prev{left:6px}.galv-next{right:6px}
.galv-tag{position:absolute;left:12px;bottom:12px;background:rgba(0,0,0,.6);font-size:12.5px;padding:3px 8px;border-radius:8px}
.galv-bot{padding:10px 14px calc(env(safe-area-inset-bottom,0px) + 14px)}
.galv-info{font-size:13.5px;opacity:.85;margin-bottom:10px}
.galv-acts{display:flex;gap:8px}
.galv-acts button{flex:1;min-width:0;height:46px;border-radius:12px;border:0;font-weight:700;font-size:14.5px;background:rgba(255,255,255,.16);color:#fff}
.galv-acts .yes{background:var(--accent);color:var(--on-accent)}
.galv-acts [aria-pressed="true"]{box-shadow:0 0 0 2px #fff inset}`;
  document.head.appendChild(s);
}
function srcSummary(idx) {
  const c = {};
  for (const i of idx) { const f = G.data.folders.get(G.data.media[i].fk); const n = /whatsapp/i.test(f.rel) ? 'WhatsApp' : /^dcim\/camera\/$/i.test(f.rel) ? 'Cámara' : /^download/i.test(f.rel) ? 'Descargas' : /screenshots\/$/i.test(f.rel) ? 'Capturas' : f.name; c[n] = (c[n] || 0) + 1; }
  return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([n, v]) => n + ' ' + fmtN(v)).join(', ');
}
const pkOf = it => it.vol + ':' + it.id;
function imgTag(it) { const k = pkOf(it); const u = G.thumbs.get(k); return `<img alt="" ${u ? `src="${u}"` : `data-galth="${esc(k)}" data-t="${it.t}"`}>`; }
function thumbsHTML(op) {
  const n = op.idx.length;
  const pos = n <= 4 ? op.idx.map((_, j) => j) : [0, Math.floor(n / 3), Math.floor(2 * n / 3), n - 1];
  return '<div class="gth">' + pos.map(j => `<button data-gal="view" data-k="${esc(op.k)}" data-n="${j}" aria-label="Ver la foto en grande">${imgTag(G.data.media[op.idx[j]])}</button>`).join('') +
    (n > 4 ? `<button class="galedit gall" data-gal="view" data-k="${esc(op.k)}" data-n="0">Ver las ${fmtN(n)}</button>` : '') + '</div>';
}
function pickState(op, i) { return (G.cfg.pick || {})[pkOf(G.data.media[i]) + '>' + op.album.key] || 0; }
function pickRow(op) {
  const to = albumRel(G.plan, G.cfg, op.album, G.data.folders);
  const sel = op.idx.filter(i => pickState(op, i) === 1).length, no = op.idx.filter(i => pickState(op, i) === -1).length;
  const one = op.idx.length === 1;
  const q = one ? `¿Va a «${esc(lastSeg(to))}» esta foto ${esc(deL(op.day))}?` : `¿Cuáles de estas ${fotos(op.idx.length)} ${esc(deL(op.day))} van a «${esc(lastSeg(to))}»?`;
  const hint = one ? 'Tócala para verla en grande y márcala ✓ si va a este álbum.' : 'Toca una foto para verla en grande. Marca ✓ las que van a este álbum.';
  const state = sel || no ? [sel ? fmtN(sel) + (sel === 1 ? ' marcada' : ' marcadas') : '', no ? fmtN(no) + (no === 1 ? ' no es de aquí' : ' no son de aquí') : ''].filter(Boolean).join(', ') + '.' : (one ? 'Si no la marcas, se queda suelta.' : 'Las que no marques se quedan sueltas.');
  return `<div class="galop galpick"><div class="tx"><span class="t">${q}</span><span class="m">${hint} ${state}</span>${op.album.kind === 'people' ? '' : nameHTML(op.album)}
<div class="galgrid">${op.idx.map((i, j) => { const st = pickState(op, i), it = G.data.media[i]; return `<div class="galcell${st === -1 ? ' no' : ''}"><button class="galimg" data-gal="view" data-k="${esc(op.k)}" data-n="${j}" aria-label="Ver la foto en grande">${imgTag(it)}</button><button class="galmark" data-gal="mark" data-k="${esc(op.k)}" data-n="${j}" aria-pressed="${st === 1}" aria-label="Va a este álbum">${CHECK}</button>${st === -1 ? '<span class="nox">No</span>' : ''}${it.t === 3 ? '<span class="vidx">Vídeo</span>' : ''}</div>`; }).join('')}</div>
${one ? '' : `<div class="galbtns"><button class="sec" data-gal="pickall" data-k="${esc(op.k)}">Marcar todas</button><button class="sec" data-gal="picknone" data-k="${esc(op.k)}">Ninguna es de aquí</button></div>`}</div></div>`;
}
function nameSugs(al) {
  const out = [];
  const add = v => { v = cleanName(v); if (v && !out.some(x => nrm(x) === nrm(v))) out.push(v); };
  add(al.label);
  if (al.link) add(al.link.title);
  if (al.base) add(al.date ? stripYear(al.base, al.date) : al.base);
  if (al.place) { add(al.place); if (al.auto === 'far') add('Viaje a ' + al.place); }
  const H = G.hints || {}, S = A().S, days = [];
  for (const [a, b] of (al.ranges || [])) for (let d = a; d <= b && days.length < 10; d++) days.push(dstr(d));
  for (const ds of days) {
    ((H.events || {})[ds] || []).forEach(e => add(e.title));
    ((H.bdays || {})[ds.slice(5)] || []).forEach(add);
    ((S && S.teruel) || []).filter(ev => ev.date === ds && (!ev.end || ev.end === ev.date)).slice(0, 2).forEach(ev => add(ev.title));
  }
  if (al.auto === 'trash') { add('Para borrar'); add('Capturas'); }
  if (al.auto === 'busy') ['Cumpleaños', 'Comida familiar', 'Fiesta', 'Excursión', 'Boda', 'Concierto'].forEach(add);
  if (al.auto === 'far' && !al.place) ['Viaje', 'Escapada', 'Excursión'].forEach(add);
  return out.slice(0, 9);
}
function namePreview(al, v) {
  if (al.auto === 'trash') return v;
  const m = DATE_PREFIX.exec(al.finalName);
  return (m ? al.finalName.slice(0, 10) : al.date) + ' ' + v;
}
const shownEditors = new Set();
function nameHTML(al) {
  if (!G.edit || G.edit.id !== al.id || shownEditors.has(al.id)) return `<button class="galedit" data-gal="name" data-id="${esc(al.id)}">Cambiar el nombre</button>`;
  shownEditors.add(al.id);
  const v = G.edit.value;
  return `<div class="galname"><label class="lbl">Nombre del álbum${al.auto === 'trash' ? '' : ' (la fecha va delante sola)'}<input class="field" id="gal-name" maxlength="80" autocomplete="off" value="${esc(v)}"></label><span class="m" id="gal-nprev">Quedará: «${esc(namePreview(al, cleanName(v) || al.label))}»</span><div class="chips">${nameSugs(al).map(x => `<button class="chip" data-gal="name-chip" data-v="${esc(x)}" aria-pressed="${nrm(x) === nrm(v)}">${esc(x)}</button>`).join('')}</div><div class="galbtns"><button class="pri" data-gal="name-save" data-id="${esc(al.id)}">Guardar</button><button class="sec" data-gal="name-cancel">Cancelar</button>${al.custom ? `<button class="sec" data-gal="name-reset" data-id="${esc(al.id)}">Volver al que sugería</button>` : ''}</div></div>`;
}
function opRow(op) {
  if (op.type === 'pick') return pickRow(op);
  const on = isOn(G.plan, G.cfg, op.k);
  const F = G.data.folders;
  let t = '', m = '', edit = false, extra = '';
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
    if (op.album.kind === 'people') m = (G.people && op.album.fk === G.people.pf.yoFk ? 'Fotos en las que sales tú sin nadie de tus otros álbumes. ' : 'Fotos del día a día en las que sale alguien de este álbum. ') + 'Desde ' + srcSummary(op.idx) + '.';
    else m = 'Desde ' + srcSummary(op.idx) + '.';
    edit = op.album.kind !== 'people';
  } else if (op.type === 'addday') {
    const to = albumRel(G.plan, G.cfg, op.album, F);
    t = `${op.idx.length === 1 ? 'Añadir la foto' : 'Añadir las ' + fotos(op.idx.length)} ${esc(deL(op.day))} a ${op.album.kind === 'new' && op.album.auto !== 'trash' ? 'un álbum nuevo, ' : ''}${q(lastSeg(to))}`;
    m = 'Desde ' + srcSummary(op.idx) + '.';
    edit = op.album.kind !== 'people';
  } else {
    const al = op.album, L = al.link;
    if (al.auto === 'revisar') {
      t = `Llevar ${fotos(op.idx.length)} a ${q(al.finalName)}`;
      m = 'Salen personas de álbumes distintos que no tienen un orden entre ellos (por ejemplo, de Amigos máster y de Familia). Ahí decides tú adónde va cada una.';
    } else if (al.auto === 'trash') {
      t = `Llevar ${fotos(op.idx.length)} a ${q(al.finalName)}`;
      m = 'Capturas de pantalla que no son de ningún viaje. Ahí decides tú cuáles borrar desde la Galería.';
    } else {
      t = `Crear ${q(al.finalName)} con ${fotos(op.idx.length)}`;
      const r = al.ranges[0];
      if (al.auto === 'far') m = `Fotos lejos de Teruel ${rango(dstr(r[0]), dstr(r[1])).replace(/^/, r[0] === r[1] ? 'el ' : 'del ')}. Desde ${srcSummary(op.idx)}.`;
      else if (al.auto === 'busy') m = `${r[0] === r[1] ? 'Día' : 'Días'} con muchas fotos de la cámara${al.hint ? ', y en Día a día tienes «' + esc(al.hint) + '»' : ''}. ${al.custom || al.hint ? '' : 'Ponle el nombre que quieras. '}Desde ${srcSummary(op.idx)}.`;
      else m = (L.kind === 'viaje' ? 'Viaje' : 'Evento') + ' de Día a día, ' + rango(L.date, L.end) + '. Desde ' + srcSummary(op.idx) + '.';
    }
    edit = true;
  }
  extra = op.album && op.album.auto === 'far' && op.album.trip ? `<div class="galbtns"><button class="sec" data-gal="trip" data-k="${esc(op.album.trip.key)}">Apuntar el viaje en Día a día</button><button class="sec" data-gal="home" data-k="${esc(op.album.trip.key)}">Es otra casa</button><button class="sec" data-gal="dismiss" data-k="${esc(op.album.trip.key)}">No es un viaje</button></div>` : '';
  return `<div class="galop"><button class="galck" data-gal="op" data-k="${esc(op.k)}" aria-pressed="${on}" aria-label="Hacer este cambio">${CHECK}</button><div class="tx"><span class="t">${t}</span><span class="m">${m}</span>${edit ? nameHTML(op.album) : ''}${extra}${thumbsHTML(op)}</div></div>`;
}
function masGaleria() {
  injectCSS();
  const back = A().backHTML ? A().backHTML() : '';
  let h = back + `<h1 class="title t2">Galería</h1><p class="sub" style="margin-top:8px">Ordena las fotos de Cámara, WhatsApp, Descargas y Capturas en álbumes con fecha: tus viajes y eventos, y los que la app crea cuando ve un viaje o un día con muchas fotos. Primero ves los cambios y eliges cuáles hacer. Nunca se borra ninguna foto.</p>`;
  if (!(A().isNative && A().isNative())) return h + `<section class="card"><p class="sub">Esto solo funciona en la app de Android.</p></section>`;
  if (!G.status) { refreshStatus().then(rerender); return h + `<section class="card"><p class="sub">Comprobando permisos…</p></section>`; }
  const st = G.status;
  if (st.none) return h + `<section class="card"><p class="sub">Falta instalar la versión nueva de la app (APK) para usar la galería.</p></section>`;
  if (st.sdk < 30) return h + `<section class="card"><p class="sub">Hace falta Android 11 o más nuevo.</p></section>`;
  if (!st.allFiles) {
    return h + `<section class="card"><h2>Un permiso antes de empezar</h2><p class="sub">Para mover fotos entre álbumes, Android pide que actives «Permitir acceso para gestionar todos los archivos» para Día a día. Se activa una vez.</p><div class="btnrow"><button class="pri" data-gal="perm">Abrir el permiso</button><button class="sec" data-gal="recheck">Ya lo he activado</button></div></section>`;
  }
  if (G.err) h += `<p class="err">${esc(G.err)}</p>`;
  if (G.stage === 'scanning' || G.stage === 'gps' || G.stage === 'applying' || G.stage === 'faces') {
    const pr = G.prog || { text: '', done: 0, total: 0 };
    const faces = G.stage === 'faces';
    return h + `<section class="card"><p class="sub" id="gal-ptx">${esc(pr.text)}</p><span class="prog"><i id="gal-prog" style="width:${pr.total ? Math.round(100 * pr.done / pr.total) : 0}%"></i></span><p class="sub" style="margin-top:10px">${faces ? 'Todo se hace dentro del móvil. Puedes parar cuando quieras: lo que ya ha mirado se guarda y la próxima vez sigue por donde iba.' : 'No cierres la app hasta que termine.'}</p>${faces ? `<div class="btnrow"><button class="sec" data-gal="faces-stop"${G.stopFaces ? ' disabled' : ''}>${G.stopFaces ? 'Parando…' : 'Parar'}</button></div>` : ''}</section>`;
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
  shownEditors.clear();
  const assigned = pl.assigned;
  h += `<div class="galsum"><div><b>${fmtN(G.data.media.length)}</b><span>fotos y vídeos</span></div><div><b>${fmtN(pl.loose.length + pl.caps.length)}</b><span>sueltas en Cámara, WhatsApp, Descargas y Capturas</span></div><div><b>${fmtN(assigned)}</b><span>de esas ya tienen álbum propuesto</span></div><div><b>${fmtN(pl.unassigned.length)}</b><span>${G.people ? 'siguen sueltas: sin caras o con gente que no está en tus álbumes' : 'del día a día: para repartirlas, reconoce caras'}</span></div></div>`;

  const nuevas = [...F.values()].filter(f => cat(f.fk) === 'nueva');
  if (nuevas.length) {
    h += `<p class="galh">Carpetas que no conozco</p><section class="card" style="margin-top:8px"><p class="sub">No se tocan hasta que digas qué son.</p>${nuevas.map(folderRow).join('')}</section>`;
  }
  if (!G.people && !G.cfg.facesOn) {
    const n = pl.unassigned.filter(i => G.data.media[i].t === 1).length;
    const min = Math.max(1, Math.round((n + 300) * 0.8 / 60));
    h += `<p class="galh">Fotos del día a día</p><section class="card" style="margin-top:8px"><h2>Reconocer caras</h2><p class="sub">Para repartir ${fotos(n)} del día a día en Familia, +, Félix… la app aprende las caras de tus álbumes de personas y busca quién sale en cada foto.</p><p class="sub">Todo se hace dentro del móvil: no se sube ninguna foto. La primera vez descarga el reconocimiento (unos 12 MB) y tarda unos ${fmtN(min)} minutos, mejor con el móvil cargando. Las siguientes veces solo mira las fotos nuevas.</p><div class="btnrow"><button class="pri" data-gal="faces">Reconocer caras</button></div></section>`;
  }
  if (G.people) h += peopleHTML();
  const groupsOps = [
    ['Tus álbumes', pl.ops.filter(o => ['rename', 'split', 'merge', 'pmerge'].includes(o.type))],
    ['Fotos sueltas a sus álbumes', pl.ops.filter(o => o.type === 'add' && o.album.kind !== 'people')],
    ['Fotos a tus álbumes de personas', pl.ops.filter(o => o.type === 'add' && o.album.kind === 'people')],
    ['Revisar', pl.ops.filter(o => o.type === 'new' && o.album.auto === 'revisar')],
    ['Álbumes nuevos', pl.ops.filter(o => o.type === 'new' && o.album.auto !== 'trash' && o.album.auto !== 'revisar')],
    ['Para borrar', pl.ops.filter(o => o.type === 'new' && o.album.auto === 'trash')],
    ['Fotos sueltas, por días', pl.ops.filter(o => o.type === 'addday')],
    ['Fotos sueltas, una a una', pl.ops.filter(o => o.type === 'pick')]
  ].filter(g => g[1].length);
  if (!groupsOps.length) h += `<section class="card"><h2>Todo en orden</h2><p class="sub">No hay nada que mover en viajes y eventos.</p></section>`;
  for (const [title, list] of groupsOps) h += `<p class="galh">${esc(title)}</p><section class="card" style="margin-top:8px">${list.map(opRow).join('')}</section>`;

  const nd = Object.keys(G.cfg.decl || {}).length + Object.keys(G.cfg.np || {}).length;
  if (nd) h += `<p class="galh">Lo que has descartado</p><section class="card" style="margin-top:8px"><p class="sub">${fmtN(nd)} ${nd === 1 ? 'cambio o foto descartada' : 'cambios o fotos descartados'}. No te los vuelvo a proponer igual.</p><div class="btnrow"><button class="sec" data-gal="restore">Volver a proponerlo todo</button></div>${G.confirm === 'restore' ? `<div class="galbtns" style="margin-top:12px"><span class="sub" style="width:100%;margin:0">¿Vuelvo a proponerte todo lo que descartaste?</span><button class="pri" data-gal="restore-yes">Sí, proponerlo otra vez</button><button class="sec" data-gal="cancel">Cancelar</button></div>` : ''}</section>`;
  h += `<p class="galh">Todas las carpetas</p><section class="card" style="margin-top:8px"><p class="sub">Así he entendido cada carpeta. Cámbialo si algo no cuadra.</p>`;
  if (G.showFolders) h += [...F.values()].sort((a, b) => a.name.localeCompare(b.name, 'es')).map(folderRow).join('') + `<div class="btnrow"><button class="sec" data-gal="folders">Ocultar</button></div>`;
  else h += `<div class="btnrow"><button class="sec" data-gal="folders">Ver las ${fmtN(F.size)} carpetas</button></div>`;
  h += `</section>`;

  h += `<section class="card"><p class="sub">${moves.length ? `Con lo marcado se mueven ${fotos(moves.length)}. No se borra ninguna, y puedes deshacerlo después.` : 'No hay nada marcado.'}</p><p class="sub">Lo que dejes sin marcar no te lo vuelvo a proponer igual: las fotos sueltas te las propongo por días y, si tampoco, una a una.</p><div class="btnrow"><button class="pri" data-gal="apply" ${moves.length ? '' : 'disabled'}>Aplicar los cambios</button><button class="sec" data-gal="scan">Volver a analizar</button>${G.cfg.lastRun ? `<button class="sec" data-gal="undo">Deshacer la última vez</button>` : ''}</div>${G.confirm === 'apply' ? confirmHTML('apply', moves.length) : ''}${G.confirm === 'undo' ? confirmHTML('undo') : ''}</section>`;
  setTimeout(loadThumbs, 0);
  setTimeout(loadCrops, 0);
  return h;
}
function faceImg(per) {
  if (per.crop) return `<img alt="" src="${per.crop}">`;
  return `<img alt="" data-galface="${esc(per.id)}">`;
}
function peopleHTML() {
  const pf = G.people.pf;
  const opts = [['yo', 'Soy yo']].concat(pf.list.filter(f => !pf.mergeTo[f.fk] && f.fk !== pf.yoFk).map(f => [f.fk, f.name]), [['no', 'No repartir']]);
  const ps = G.people.persons.filter(x => x.n >= 3 || x.src === 'user').sort((a, b) => b.n - a.n);
  if (!ps.length) return `<p class="galh">Quién es quién</p><section class="card" style="margin-top:8px"><p class="sub">No he encontrado caras que se repitan lo suficiente.</p></section>`;
  const shown = G.showAllPeople ? ps : ps.slice(0, 18);
  const order = pf.prio.map(fk => G.data.folders.get(fk).name).join(', ');
  return `<p class="galh">Quién es quién</p><section class="card" style="margin-top:8px"><p class="sub">Las personas que más salen en tus fotos. Te sugiero su álbum según tus álbumes de personas; cámbialo si no acierto y la app lo recordará.${order ? ` Si en una foto salen personas de varios álbumes, manda este orden: ${esc(order)}. Si se mezclan otros, va a «Revisar».` : ''}</p>
<div class="galppl">${shown.map(x => `<div class="galp"><span class="galface">${faceImg(x)}</span><span class="m">${fotos(x.n)}${x.src === 'user' ? '' : ', sugerido'}</span><select class="field galsel" data-galperson="${esc(x.id)}" aria-label="Álbum de esta persona">${opts.map(([v, l]) => `<option value="${esc(v)}"${v === x.album ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div>`).join('')}</div>
${ps.length > 18 ? `<div class="btnrow"><button class="sec" data-gal="ppl-all">${G.showAllPeople ? 'Ver menos' : 'Ver las ' + fmtN(ps.length) + ' personas'}</button></div>` : ''}</section>`;
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

/* ---------- visor para ver las fotos en grande ---------- */
const V = { open: false, op: null, list: [], i: 0, big: new Map(), backReg: false };
const Z = { s: 1, x: 0, y: 0 };
function vEl(id) { return document.getElementById(id); }
function buildV() {
  if (vEl('gal-v')) return;
  const d = document.createElement('div');
  d.className = 'galv'; d.id = 'gal-v'; d.hidden = true;
  d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-label', 'Foto en grande');
  d.innerHTML = `<div class="galv-top"><span class="n" id="gal-vn"></span><button class="galv-x" data-gal="v-close" aria-label="Cerrar">×</button></div>
<div class="galv-stage" id="gal-vs"><img id="gal-vimg" alt=""><span class="galv-tag" id="gal-vtag" hidden>Vídeo</span><button class="galv-nav galv-prev" id="gal-vp" data-gal="v-prev" aria-label="Foto anterior">‹</button><button class="galv-nav galv-next" id="gal-vx" data-gal="v-next" aria-label="Foto siguiente">›</button></div>
<div class="galv-bot"><div class="galv-info" id="gal-vinfo"></div><div class="galv-acts" id="gal-vacts"></div></div>`;
  document.body.appendChild(d);
  const st = vEl('gal-vs'), img = vEl('gal-vimg');
  const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  let t0 = null, lastTap = 0;
  const one = (p, moved) => ({ mode: Z.s > 1 ? 'pan' : 'swipe', px: p.clientX, py: p.clientY, x: Z.x, y: Z.y, dx: 0, moved });
  st.addEventListener('touchstart', e => {
    if (e.target.closest('button')) { t0 = null; return; }
    if (e.touches.length === 2) t0 = { mode: 'pinch', d: dist(e.touches), s: Z.s };
    else if (e.touches.length === 1) t0 = one(e.touches[0], false);
  }, { passive: true });
  st.addEventListener('touchmove', e => {
    if (!t0) return;
    e.preventDefault();
    if (t0.mode === 'pinch' && e.touches.length === 2) { Z.s = Math.max(1, Math.min(5, t0.s * dist(e.touches) / t0.d)); if (Z.s === 1) { Z.x = 0; Z.y = 0; } applyZ(); return; }
    if (e.touches.length !== 1 || t0.mode === 'pinch') return;
    const p = e.touches[0], dx = p.clientX - t0.px, dy = p.clientY - t0.py;
    if (Math.abs(dx) + Math.abs(dy) > 8) t0.moved = true;
    if (t0.mode === 'pan') { Z.x = t0.x + dx; Z.y = t0.y + dy; applyZ(); }
    else { t0.dx = dx; img.style.transform = 'translateX(' + dx + 'px)'; }
  }, { passive: false });
  st.addEventListener('touchend', e => {
    if (!t0) return;
    if (t0.mode === 'swipe') {
      img.style.transform = '';
      if (t0.dx < -60) stepV(1); else if (t0.dx > 60) stepV(-1); else if (!t0.moved) tapV();
    } else if (t0.mode === 'pan' && !t0.moved) tapV();
    t0 = e.touches.length === 1 ? one(e.touches[0], true) : null;
  });
  function tapV() {
    const now = Date.now();
    if (now - lastTap < 320) { if (Z.s > 1) { Z.s = 1; Z.x = 0; Z.y = 0; } else Z.s = 2.5; applyZ(); lastTap = 0; }
    else lastTap = now;
  }
  document.addEventListener('keydown', e => { if (!V.open) return; if (e.key === 'Escape') closeV(false); else if (e.key === 'ArrowRight') stepV(1); else if (e.key === 'ArrowLeft') stepV(-1); });
}
function applyZ() { const img = vEl('gal-vimg'); if (img) img.style.transform = Z.s === 1 ? '' : 'translate(' + Z.x + 'px,' + Z.y + 'px) scale(' + Z.s + ')'; }
function srcName(it) { const f = G.data.folders.get(it.fk); return /whatsapp/i.test(f.rel) ? 'WhatsApp' : /^dcim\/camera\/$/i.test(f.rel) ? 'Cámara' : /^download/i.test(f.rel) ? 'Descargas' : /screenshots\/$/i.test(f.rel) ? 'Capturas' : f.name; }
function openV(k, n) {
  if (!G.plan || !G.data) return;
  const op = G.plan.ops.find(o => o.k === k); if (!op || !op.idx.length) return;
  buildV();
  V.op = op; V.list = op.idx.slice(); V.i = Math.max(0, Math.min(n || 0, V.list.length - 1)); V.open = true;
  vEl('gal-v').hidden = false;
  const S = A().S; if (S) S.viewer = { gal: true };
  document.documentElement.classList.add('locked');
  if (!V.backReg) {
    const App = A().plug && A().plug('App');
    if (App && App.addListener) { V.backReg = true; try { App.addListener('backButton', () => { if (V.open) closeV(true); }); } catch (_) {} }
  }
  showV();
}
function closeV(fromBack) {
  if (!V.open) return;
  V.open = false;
  const v = vEl('gal-v'); if (v) v.hidden = true;
  const img = vEl('gal-vimg'); if (img) { img.removeAttribute('src'); img.style.transform = ''; }
  const S = A().S;
  if (!fromBack && S && S.viewer && S.viewer.gal) S.viewer = null;
  if (S && !S.sheet) document.documentElement.classList.remove('locked');
  rerender();
}
function stepV(d) { if (!V.open) return; const n = V.i + d; if (n < 0 || n >= V.list.length) return; V.i = n; showV(); }
function showV() {
  const op = V.op, i = V.list[V.i], it = G.data.media[i], k = pkOf(it);
  Z.s = 1; Z.x = 0; Z.y = 0;
  const img = vEl('gal-vimg'); img.style.transform = '';
  img.src = V.big.get(k) || G.thumbs.get(k) || '';
  vEl('gal-vtag').hidden = it.t !== 3;
  vEl('gal-vn').textContent = fmtN(V.i + 1) + ' de ' + fmtN(V.list.length);
  vEl('gal-vp').hidden = V.i === 0; vEl('gal-vx').hidden = V.i >= V.list.length - 1;
  vEl('gal-vinfo').textContent = (it.day ? fechaLarga(it.day) + ', ' : '') + srcName(it) + (it.t === 3 ? '. Es un vídeo: aquí ves un fotograma.' : '');
  let acts = '';
  if (op.type === 'pick') { const st = pickState(op, i); acts = `<button class="yes" data-gal="v-add" aria-pressed="${st === 1}">Va a este álbum</button><button data-gal="v-no" aria-pressed="${st === -1}">No es de aquí</button>`; }
  else if (['add', 'new', 'addday'].includes(op.type)) acts = `<button data-gal="v-remove">Quitar esta foto del cambio</button>`;
  vEl('gal-vacts').innerHTML = acts;
  if (!V.big.has(k)) {
    const p = P(); if (!p) return;
    p.thumb({ id: it.id, type: it.t, vol: it.vol, size: 1600 }).then(r => {
      const u = 'data:image/jpeg;base64,' + r.data;
      V.big.set(k, u);
      if (V.big.size > 24) V.big.delete(V.big.keys().next().value);
      if (V.open && V.list[V.i] === i) vEl('gal-vimg').src = u;
    }).catch(() => {});
  }
}
function setPick(op, i, v) {
  const key = pkOf(G.data.media[i]) + '>' + op.album.key;
  if (v) G.cfg.pick[key] = v; else delete G.cfg.pick[key];
}

/* ---------- toques ---------- */
function autoByTrip(k) { return G.plan && G.plan.albums.find(a => a.auto === 'far' && a.trip && a.trip.key === k); }
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
  if (act === 'view') { openV(d.k, +d.n || 0); return; }
  if (act === 'v-close') { closeV(false); return; }
  if (act === 'v-prev') { stepV(-1); return; }
  if (act === 'v-next') { stepV(1); return; }
  if (act === 'v-add' || act === 'v-no') {
    if (!V.open || V.op.type !== 'pick') return;
    const i = V.list[V.i], want = act === 'v-add' ? 1 : -1;
    setPick(V.op, i, pickState(V.op, i) === want ? 0 : want); saveCfg();
    if (V.i < V.list.length - 1) stepV(1); else showV();
    return;
  }
  if (act === 'v-remove') {
    if (!V.open) return;
    const i = V.list[V.i], al = V.op.album;
    G.cfg.np[pkOf(G.data.media[i]) + '>' + al.key] = 1; saveCfg();
    const k = V.op.k;
    replan();
    const op = G.plan.ops.find(o => o.k === k);
    if (!op || !op.idx.length) { closeV(false); return; }
    V.op = op; V.list = op.idx.slice(); V.i = Math.min(V.i, V.list.length - 1);
    showV(); return;
  }
  if (act === 'mark') {
    const op = G.plan && G.plan.ops.find(o => o.k === d.k); if (!op) return;
    const i = op.idx[+d.n]; setPick(op, i, pickState(op, i) === 1 ? 0 : 1); saveCfg(); rerender(); return;
  }
  if (act === 'pickall' || act === 'picknone') {
    const op = G.plan && G.plan.ops.find(o => o.k === d.k); if (!op) return;
    for (const i of op.idx) { const st = pickState(op, i); if (act === 'pickall' && st !== -1) setPick(op, i, 1); if (act === 'picknone' && st !== 1) setPick(op, i, -1); }
    saveCfg(); rerender(); return;
  }
  if (act === 'faces') { analyzeFaces(); return; }
  if (act === 'faces-stop') { G.stopFaces = true; rerender(); return; }
  if (act === 'ppl-all') { G.showAllPeople = !G.showAllPeople; rerender(); return; }
  if (act === 'restore') { G.confirm = 'restore'; rerender(); return; }
  if (act === 'restore-yes') { G.cfg.decl = {}; G.cfg.np = {}; G.cfg.off = {}; G.cfg.pick = {}; G.confirm = null; saveCfg(); replan(); rerender(); return; }
  if (act === 'op') { G.cfg.off[d.k] = !G.cfg.off[d.k]; if (!G.cfg.off[d.k]) delete G.cfg.off[d.k]; saveCfg(); rerender(); return; }
  if (act === 'name') {
    const al = G.plan && G.plan.albums.find(a => a.id === d.id); if (!al) return;
    G.edit = { id: al.id, value: al.label }; rerender();
    setTimeout(() => { const i = document.getElementById('gal-name'); if (i) { i.focus(); try { i.setSelectionRange(i.value.length, i.value.length); } catch (_) {} } }, 30);
    return;
  }
  if (act === 'name-chip') {
    if (!G.edit) return;
    G.edit.value = d.v;
    const i = document.getElementById('gal-name'); if (i) i.value = d.v;
    rerender(); return;
  }
  if (act === 'name-cancel') { G.edit = null; rerender(); return; }
  if (act === 'name-save' || act === 'name-reset') {
    const al = G.plan && G.plan.albums.find(a => a.id === d.id); if (!al) return;
    const i = document.getElementById('gal-name');
    const n = act === 'name-reset' ? '' : cleanName(i ? i.value : (G.edit && G.edit.value));
    if (n && n !== al.label) G.cfg.names[al.id] = n; else if (!n) delete G.cfg.names[al.id];
    G.edit = null; saveCfg(); replan(); rerender(); return;
  }
  if (act === 'ev') {
    const S = A().S, e = S && S.entries.get(d.id); if (!e) return;
    A().persist(Object.assign({}, e, { album: d.v === '1' }), true);
    replan(); rerender(); return;
  }
  if (act === 'trip') {
    const al = autoByTrip(d.k); if (!al) return;
    const t = al.trip;
    const e = { id: A().newId(), kind: 'viaje', title: al.label || al.place || 'Viaje', date: t.from, end: t.to, budget: null, created: Date.now() };
    A().persist(e, true);
    if (G.cfg.names[al.id]) { G.cfg.names['n:' + e.id] = G.cfg.names[al.id]; saveCfg(); }
    try { if (A().linkTripEntries) A().linkTripEntries(e); if (A().queueGeo) A().queueGeo(e.id); } catch (_) {}
    if (A().toast) A().toast('Viaje apuntado en Día a día');
    replan(); rerender(); return;
  }
  if (act === 'home') {
    const al = autoByTrip(d.k); if (!al) return;
    G.cfg.homes.push({ name: al.place || 'Otra casa', lat: al.trip.lat, lon: al.trip.lon, radio: 30 });
    saveCfg(); replan(); rerender(); return;
  }
  if (act === 'dismiss') { G.cfg.dismissed.push(d.k); saveCfg(); replan(); rerender(); return; }
}
function onInput(ev) {
  const t = ev.target;
  if (!t || t.id !== 'gal-name' || !G.edit || !G.plan) return;
  G.edit.value = t.value;
  const al = G.plan.albums.find(a => a.id === G.edit.id), pv = document.getElementById('gal-nprev');
  if (al && pv) pv.textContent = 'Quedará: «' + namePreview(al, cleanName(t.value) || al.label) + '»';
}
function onChange(ev) {
  const s = ev.target;
  if (s && s.dataset && s.dataset.galperson && G.people) {
    const id = s.dataset.galperson;
    const st = (G.cfg.persons || []).find(x => x.id === id), per = G.people.persons.find(x => x.id === id);
    if (st) { st.album = s.value; st.src = 'user'; }
    if (per) { per.album = s.value; per.src = 'user'; }
    saveCfg(); replan(); rerender(); return;
  }
  if (!s || !s.dataset || !s.dataset.galcat) return;
  const f = G.data && G.data.folders.get(s.dataset.galcat);
  if (!f) return;
  if (s.value === f.auto) delete G.cfg.cats[f.fk]; else G.cfg.cats[f.fk] = s.value;
  saveCfg(); replan(); rerender();
}

if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('click', ev => { onClick(ev).catch(() => {}); });
  document.addEventListener('change', onChange);
  document.addEventListener('input', onInput);
  document.addEventListener('visibilitychange', () => {
    const S = A().S;
    if (!document.hidden && S && S.view === 'mas' && S.mas === 'galeria' && !G.busy) refreshStatus().then(rerender);
  });
}

W.masGaleria = masGaleria;
W.GaleriaCore = { classifyFolder, mediaDay, prepare, buildPlan, computeMoves, albumRel, dnum, dstr, encD, decD, fdist, clusterFaces, suggestPeople };
})();
