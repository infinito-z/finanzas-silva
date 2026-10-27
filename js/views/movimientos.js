import { getState, upsert, upsertMany, remove } from '../store.js';
import { money, todayISO, esc, uid } from '../format.js';
import { MEDIOS, INGRESO_CATS } from '../schema.js';
import { session, monthNavHTML, bindMonthNav, formModal, toast, dateCell } from '../ui.js';
import * as sheets from '../sheets.js';

const filtro = { tipo: '', cat: '', q: '' };

export function movimientoModal(m = {}) {
  const s = getState();
  formModal({
    title: m.id ? 'Editar movimiento' : 'Nuevo movimiento',
    values: { fecha: todayISO(), tipo: 'gasto', medio: 'Efectivo', categoria: 'Alimentación', ...m },
    fields: [
      { name: 'tipo', label: 'Tipo', type: 'select', options: [{ value: 'gasto', label: 'Gasto' }, { value: 'ingreso', label: 'Ingreso' }] },
      { name: 'monto', label: 'Monto (S/)', type: 'number', min: 0.01 },
      { name: 'fecha', label: 'Fecha', type: 'date' },
      { name: 'categoria', label: 'Categoría', type: 'select', options: s.categorias.map((c) => c.nombre) },
      { name: 'servicio', label: 'Servicio / comercio', list: [...new Set(s.movimientos.map((x) => x.servicio).filter(Boolean))], required: false },
      { name: 'medio', label: 'Medio de pago', type: 'select', options: MEDIOS },
      { name: 'nota', label: 'Nota', type: 'textarea', required: false },
    ],
    onSubmit: (v) => { upsert('movimientos', { ...m, ...v, ingresoRecId: m.ingresoRecId || '' }); toast('Movimiento guardado'); },
    onDelete: m.id ? () => remove('movimientos', m.id) : undefined,
  });
}

function parseCSV(text) {
  const rows = text.trim().split(/\r?\n/).map((l) => {
    const out = []; let cur = ''; let q = false;
    for (const ch of l) {
      if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch;
    }
    out.push(cur);
    return out.map((c) => c.trim());
  });
  const head = rows.shift().map((h) => h.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''));
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

function importCSV(text) {
  const nuevos = parseCSV(text).map((r) => ({
    id: uid(), fecha: (r.fecha || todayISO()).slice(0, 10), tipo: /ingreso/i.test(r.tipo || '') ? 'ingreso' : 'gasto',
    monto: Math.abs(parseFloat(String(r.monto).replace(/[^0-9.-]/g, ''))) || 0, categoria: r.categoria || 'Otros',
    servicio: r.servicio || '', nota: r.nota || '', medio: r.medio || 'Efectivo', ingresoRecId: '',
  })).filter((m) => m.monto > 0 && /^\d{4}-\d{2}-\d{2}$/.test(m.fecha));
  if (nuevos.length) upsertMany('movimientos', nuevos);
  toast(nuevos.length ? `${nuevos.length} movimientos importados` : 'No se encontraron filas válidas (columnas: fecha, tipo, monto, categoria, servicio, nota; fecha AAAA-MM-DD)', nuevos.length ? 'ok' : 'warn');
}

export function render(root) {
  const s = getState();
  root.innerHTML = `
    <div class="row between wrap">
      ${monthNavHTML()}
      <div class="row wrap">
        <button class="btn primary" id="nuevo">+ Nuevo</button>
        <button class="btn" id="csv">Importar CSV</button>
        <button class="btn" id="form">Importar del Formulario</button>
        <input type="file" id="file" accept=".csv,text/csv" hidden>
      </div>
    </div>
    <div class="card filters">
      <select id="ftipo"><option value="">Todos</option><option value="gasto">Gastos</option><option value="ingreso">Ingresos</option></select>
      <select id="fcat"><option value="">Todas las categorías</option>${s.categorias.map((c) => `<option>${esc(c.nombre)}</option>`).join('')}</select>
      <input id="fq" type="search" placeholder="Buscar servicio o nota…">
    </div>
    <div class="card"><div id="tabla"></div></div>`;
  bindMonthNav(root, () => render(root));
  const $ = (id) => root.querySelector(id);
  $('#ftipo').value = filtro.tipo; $('#fcat').value = filtro.cat; $('#fq').value = filtro.q;

  function tabla() {
    const q = filtro.q.toLowerCase();
    const rows = getState().movimientos
      .filter((m) => m.fecha.slice(0, 7) === session.month && (!filtro.tipo || m.tipo === filtro.tipo) && (!filtro.cat || m.categoria === filtro.cat)
        && (!q || `${m.servicio} ${m.nota} ${m.categoria}`.toLowerCase().includes(q)))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
    const total = rows.reduce((t, m) => t + (m.tipo === 'ingreso' ? m.monto : -m.monto), 0);
    $('#tabla').innerHTML = rows.length
      ? `<table class="tbl"><thead><tr><th>Fecha</th><th>Detalle</th><th>Categoría</th><th class="num">Monto</th><th></th></tr></thead><tbody>
        ${rows.map((m) => `<tr><td>${dateCell(m.fecha)}</td><td>${esc(m.servicio || '—')}<br><small class="muted">${esc(m.medio)}${m.nota ? ` · ${esc(m.nota)}` : ''}</small></td><td>${esc(m.categoria)}</td>
        <td class="num ${m.tipo === 'ingreso' ? 'in' : 'out'}">${m.tipo === 'ingreso' ? '+' : '−'}${money(m.monto)}</td><td><button class="btn ghost" data-edit="${esc(m.id)}" aria-label="Editar">✎</button></td></tr>`).join('')}
        </tbody><tfoot><tr><td colspan="3">${rows.length} movimientos · neto</td><td class="num ${total < 0 ? 'out' : 'in'}">${money(total)}</td><td></td></tr></tfoot></table>`
      : '<p class="muted">Sin movimientos para este filtro.</p>';
    root.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => movimientoModal(getState().movimientos.find((m) => m.id === b.dataset.edit))));
  }
  tabla();

  $('#nuevo').onclick = () => movimientoModal();
  $('#ftipo').onchange = (e) => { filtro.tipo = e.target.value; tabla(); };
  $('#fcat').onchange = (e) => { filtro.cat = e.target.value; tabla(); };
  $('#fq').oninput = (e) => { filtro.q = e.target.value; tabla(); };
  $('#csv').onclick = () => $('#file').click();
  $('#file').onchange = async (e) => { const f = e.target.files[0]; if (f) importCSV(await f.text()); };
  $('#form').onclick = async () => {
    if (!sheets.configured()) return toast('Primero conecta tu Google Sheet en Ajustes', 'warn');
    const r = await sheets.importForm();
    toast(r.ok ? `${r.importados} respuestas del Formulario importadas` : `Error: ${r.error}`, r.ok ? 'ok' : 'error');
  };
}

export { INGRESO_CATS };
