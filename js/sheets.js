import * as store from './store.js';

export const status = { estado: 'local', msg: 'Solo local (sin Google Sheets)', hora: null };
let busy = false;
let timer;

export const configured = () => {
  const c = store.getConn();
  return Boolean(c.url && c.token);
};

async function get(action) {
  const { url, token } = store.getConn();
  const r = await fetch(`${url}?action=${action}&token=${encodeURIComponent(token)}`);
  return r.json();
}

async function post(body) {
  const { url, token } = store.getConn();
  // text/plain evita el preflight CORS que Apps Script no soporta
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ token, ...body }) });
  return r.json();
}

export async function sync() {
  if (!configured()) {
    Object.assign(status, { estado: 'local', msg: 'Solo local (sin Google Sheets)' });
    return { ok: false, error: 'Falta URL o token' };
  }
  if (busy) return { ok: false, error: 'Sincronización en curso' };
  busy = true;
  status.estado = 'sync';
  status.msg = 'Sincronizando…';
  try {
    if (!store.isSeeded()) store.enqueueAllLocal();
    const q = store.getQueue();
    if (q.length) {
      const r = await post({ action: 'batch', ops: q });
      if (!r.ok) throw new Error(r.error || 'Error al guardar en la hoja');
      store.dropQueue(q.length);
    }
    const r = await get('all');
    if (!r.ok) throw new Error(r.error || 'Error al leer la hoja');
    store.replaceAll(r.data);
    Object.assign(status, { estado: 'ok', msg: 'Sincronizado', hora: new Date() });
    return { ok: true };
  } catch (e) {
    const msg = e.message === 'Failed to fetch' ? 'Sin conexión: los cambios quedan en cola' : e.message;
    Object.assign(status, { estado: 'error', msg });
    return { ok: false, error: msg };
  } finally {
    busy = false;
  }
}

export function scheduleSync() {
  clearTimeout(timer);
  timer = setTimeout(sync, 1500);
}

export async function importForm() {
  try {
    const r = await post({ action: 'importForm' });
    if (r.ok) await sync();
    return r;
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
