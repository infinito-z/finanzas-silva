import { SCHEMA, DEFAULT_CONFIG, DEFAULT_CATEGORIES, DEUDA_CAT } from './schema.js';
import { uid, slug, iso, addMonths, todayISO } from './format.js';

const KEY = 'finanzas-silva:v1';
const CONN = 'finanzas-silva:conn';
const subs = new Set();

const empty = () => ({ ...Object.fromEntries(Object.keys(SCHEMA).map((k) => [k, []])), queue: [], seeded: false });

function seed(s) {
  s.categorias = DEFAULT_CATEGORIES.map(([nombre, color]) => ({ id: slug(nombre), nombre, presupuesto: 0, color }));
  return s;
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw) return { ...empty(), ...raw };
  } catch { /* storage bloqueado o corrupto */ }
  return seed(empty());
}

let state = load();

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* sin almacenamiento */ }
}
function notify(kind) {
  persist();
  subs.forEach((fn) => fn(kind));
}

export const getState = () => state;
export const subscribe = (fn) => { subs.add(fn); return () => subs.delete(fn); };

export function getConfig() {
  const cfg = { ...DEFAULT_CONFIG };
  for (const r of state.config) {
    const n = Number(r.valor);
    cfg[r.id] = Number.isFinite(n) ? n : r.valor;
  }
  return cfg;
}
export function setConfig(values) {
  for (const [id, valor] of Object.entries(values)) upsert('config', { id, valor }, false);
  notify('local');
}

export function getConn() {
  try { return JSON.parse(localStorage.getItem(CONN)) || {}; } catch { return {}; }
}
export function setConn(c) {
  try { localStorage.setItem(CONN, JSON.stringify(c)); } catch { /* ignore */ }
}

function put(tab, row) {
  const arr = state[tab];
  const i = arr.findIndex((r) => r.id === row.id);
  if (i >= 0) arr[i] = row; else arr.push(row);
  state.queue.push({ op: 'upsert', tab, row });
}

export function upsert(tab, row, emit = true) {
  put(tab, { ...row, id: row.id || uid() });
  if (emit) notify('local');
}
export function upsertMany(tab, rows) {
  rows.forEach((r) => put(tab, { ...r, id: r.id || uid() }));
  notify('local');
}
export function remove(tab, id) {
  state[tab] = state[tab].filter((r) => r.id !== id);
  state.queue.push({ op: 'delete', tab, id });
  notify('local');
}

export function pagarDeuda(deudaId, fecha, monto) {
  const d = state.deudas.find((x) => x.id === deudaId);
  if (!d) return;
  const interes = Math.min(monto, d.saldo * (d.tasa / 1200));
  put('deudas', { ...d, saldo: Math.max(0, +(d.saldo - (monto - interes)).toFixed(2)), cuotasRestantes: Math.max(0, d.cuotasRestantes - 1) });
  put('pagosDeuda', { id: uid(), deudaId, fecha, monto, interes: +interes.toFixed(2) });
  put('movimientos', { id: uid(), fecha, tipo: 'gasto', monto, categoria: DEUDA_CAT, servicio: d.acreedor, nota: 'Pago de deuda', medio: 'Transferencia', ingresoRecId: '' });
  notify('local');
}

export function registrarIngreso(ing, fecha, monto) {
  put('movimientos', { id: uid(), fecha, tipo: 'ingreso', monto, categoria: 'Sueldo', servicio: ing.nombre, nota: 'Pago recibido', medio: 'Transferencia', ingresoRecId: ing.id });
  notify('local');
}

// ---- sincronización con Google Sheets ----
export const getQueue = () => state.queue.slice();
export function dropQueue(n) { state.queue.splice(0, n); persist(); }
export function isSeeded() { return state.seeded; }
export function enqueueAllLocal() {
  for (const tab of Object.keys(SCHEMA)) state[tab].forEach((row) => state.queue.push({ op: 'upsert', tab, row }));
  state.seeded = true;
  persist();
}

export function replaceAll(data) {
  for (const [tab, def] of Object.entries(SCHEMA)) {
    const rows = (data[tab] || []).filter((r) => r.id !== '' && r.id != null).map((r) => {
      const o = {};
      for (const c of def.cols) o[c] = def.num.includes(c) ? Number(r[c]) || 0 : String(r[c] ?? '');
      return o;
    });
    // la hoja vacía no debe borrar las categorías por defecto
    if (tab === 'categorias' && !rows.length) continue;
    state[tab] = rows;
  }
  notify('remote');
}

// ---- utilidades ----
export function exportJSON() {
  const { queue, seeded, ...data } = state;
  return JSON.stringify(data, null, 2);
}
export function importJSON(text) {
  const data = JSON.parse(text);
  for (const tab of Object.keys(SCHEMA)) if (Array.isArray(data[tab])) state[tab] = data[tab];
  state.queue = [];
  state.seeded = false;
  notify('local');
}
export function resetAll() {
  state = seed(empty());
  notify('local');
}

export function loadDemo() {
  const hoy = todayISO();
  const key = hoy.slice(0, 7);
  const f = (k, d) => `${k}-${String(d).padStart(2, '0')}`;
  const movs = [];
  const gasto = (fecha, monto, categoria, servicio, medio = 'Tarjeta de débito') =>
    movs.push({ id: uid(), fecha, tipo: 'gasto', monto, categoria, servicio, nota: '', medio, ingresoRecId: '' });
  const sueldo = uid();
  state.ingresosRec = [{ id: sueldo, nombre: 'Sueldo', monto: 4500, diaPago: 28, frecuencia: 'mensual', activo: 'si' }];
  state.deudas = [
    { id: uid(), acreedor: 'Tarjeta Visa', saldo: 3200, saldoInicial: 5000, tasa: 55, cuota: 400, diaPago: 15, cuotasRestantes: 10 },
    { id: uid(), acreedor: 'Préstamo personal', saldo: 8000, saldoInicial: 12000, tasa: 22, cuota: 520, diaPago: 5, cuotasRestantes: 18 },
  ];
  state.pagosDeuda = [];
  for (let n = 3; n >= 0; n--) {
    const k = addMonths(key, -n);
    movs.push({ id: uid(), fecha: f(k, 28), tipo: 'ingreso', monto: 4500, categoria: 'Sueldo', servicio: 'Sueldo', nota: '', medio: 'Transferencia', ingresoRecId: n === 0 ? '' : sueldo });
    gasto(f(k, 1), 1200, 'Vivienda', 'Alquiler', 'Transferencia');
    gasto(f(k, 3), 95, 'Servicios', 'Luz del Sur');
    gasto(f(k, 4), 60, 'Servicios', 'Sedapal');
    gasto(f(k, 6), 110, 'Servicios', 'Internet Movistar');
    gasto(f(k, 8), 45, 'Suscripciones', 'Netflix', 'Tarjeta de crédito');
    gasto(f(k, 9), 30, 'Suscripciones', 'Spotify', 'Tarjeta de crédito');
    for (let w = 0; w < 4; w++) gasto(f(k, 5 + w * 6), 150 + ((w * 37 + n * 11) % 60), 'Alimentación', w % 2 ? 'Wong' : 'Plaza Vea');
    gasto(f(k, 12), 160 + n * 10, 'Transporte', 'Uber');
    gasto(f(k, 20), n === 0 ? 520 : 180, 'Entretenimiento', 'Restaurantes y salidas', 'Tarjeta de crédito');
    movs.push({ id: uid(), fecha: f(k, 15), tipo: 'gasto', monto: 400, categoria: DEUDA_CAT, servicio: 'Tarjeta Visa', nota: 'Pago de deuda', medio: 'Transferencia', ingresoRecId: '' });
  }
  // el mes en curso no debe tener fechas futuras
  state.movimientos = movs.filter((m) => m.fecha <= hoy || m.tipo === 'ingreso' && m.fecha.slice(0, 7) < key);
  const presupuestos = { Alimentación: 700, Transporte: 200, Servicios: 300, Entretenimiento: 250, Suscripciones: 100 };
  state.categorias = state.categorias.map((c) => ({ ...c, presupuesto: presupuestos[c.nombre] ?? c.presupuesto }));
  state.queue = [];
  state.seeded = false;
  upsert('config', { id: 'saldoDisponible', valor: 2500 }, false);
  notify('local');
}

export const mesActual = () => iso(new Date()).slice(0, 7);
