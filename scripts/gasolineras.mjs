// Descarga los precios de las gasolineras de la provincia de Teruel (Ministerio, datos abiertos)
// y guarda gasolineras.json para que la app los lea. Lo ejecuta GitHub cada hora.
import fs from 'node:fs/promises';

const PROVINCIA = process.env.PROVINCIA || '44'; // 44 = Teruel
const URL = `https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/FiltroProvincia/${PROVINCIA}`;
const OUT = process.env.GAS_FILE || 'gasolineras.json';

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : null; };
// Busca el campo aunque cambie la forma de escribirlo (tildes, mayúsculas)
const field = (o, ...names) => {
  const keys = Object.keys(o);
  for (const n of names) { const k = keys.find(k2 => norm(k2) === norm(n)); if (k) return o[k]; }
  return undefined;
};

async function get() {
  for (let i = 1; i <= 3; i++) {
    try {
      const r = await fetch(URL, { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 (DiaADia)' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) {
      console.log(`Intento ${i} fallido: ${e.message}`);
      await new Promise(res => setTimeout(res, 10000 * i));
    }
  }
  throw new Error('No se han podido descargar los precios');
}

const j = await get();
const lista = field(j, 'ListaEESSPrecio') || [];
const estaciones = lista.map(e => ({
  id: String(field(e, 'IDEESS') || ''),
  n: String(field(e, 'Rótulo', 'Rotulo') || '').trim(),
  d: String(field(e, 'Dirección', 'Direccion') || '').trim(),
  l: String(field(e, 'Localidad') || field(e, 'Municipio') || '').trim(),
  h: String(field(e, 'Horario') || '').trim(),
  lat: num(field(e, 'Latitud')),
  lon: parseFloat(String(field(e, 'Longitud (WGS84)', 'Longitud') ?? '').replace(',', '.')),
  g95: num(field(e, 'Precio Gasolina 95 E5')),
  g98: num(field(e, 'Precio Gasolina 98 E5')),
  ga: num(field(e, 'Precio Gasoleo A', 'Precio Gasóleo A')),
  gp: num(field(e, 'Precio Gasoleo Premium', 'Precio Gasóleo Premium'))
})).filter(e => e.lat && Number.isFinite(e.lon) && (e.g95 || e.ga));

if (!estaciones.length) { console.error('La respuesta no trae gasolineras. Campos recibidos:', Object.keys(j)); process.exit(1); }

const fecha = String(field(j, 'Fecha') || '');
await fs.writeFile(OUT, JSON.stringify({ updatedAt: fecha, provincia: PROVINCIA, fuente: 'Ministerio para la Transición Ecológica y el Reto Demográfico', estaciones }) + '\n');
console.log(`Guardadas ${estaciones.length} gasolineras (${fecha})`);
