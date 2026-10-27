import { getState, getConfig, upsert, remove, registrarIngreso } from '../store.js';
import { money, esc, todayISO } from '../format.js';
import { ingresoBase, flujoMes, monthTotals } from '../risk.js';
import { session, monthNavHTML, bindMonthNav, formModal, flowHTML, toast, dateCell } from '../ui.js';

function ingModal(i) {
  formModal({
    title: i ? `Editar ${i.nombre}` : 'Nuevo ingreso recurrente',
    values: i || { frecuencia: 'mensual', activo: 'si', diaPago: 28, nombre: 'Sueldo' },
    fields: [
      { name: 'nombre', label: 'Nombre (Sueldo, alquiler cobrado…)' },
      { name: 'monto', label: 'Monto por pago (S/)', type: 'number', min: 0.01 },
      { name: 'diaPago', label: 'Día de pago (1-31)', type: 'number', min: 1, max: 31 },
      { name: 'frecuencia', label: 'Frecuencia', type: 'select', options: [{ value: 'mensual', label: 'Mensual' }, { value: 'quincenal', label: 'Quincenal (2 al mes)' }] },
      { name: 'activo', label: 'Activo', type: 'select', options: [{ value: 'si', label: 'Sí' }, { value: 'no', label: 'No' }] },
    ],
    onSubmit: (v) => upsert('ingresosRec', { ...i, ...v }),
    onDelete: i ? () => remove('ingresosRec', i.id) : undefined,
  });
}

function cobroModal(i) {
  formModal({
    title: `Me pagaron: ${i.nombre}`,
    values: { fecha: todayISO(), monto: i.monto },
    fields: [{ name: 'monto', label: 'Monto recibido (S/)', type: 'number', min: 0.01 }, { name: 'fecha', label: 'Fecha', type: 'date' }],
    submitLabel: 'Registrar ingreso',
    onSubmit: (v) => { registrarIngreso(i, v.fecha, v.monto); toast('Ingreso registrado'); },
  });
}

export function render(root) {
  const s = getState();
  const cfg = getConfig();
  const hoy = todayISO();
  const key = session.month;
  const ingresos = s.movimientos.filter((m) => m.tipo === 'ingreso' && m.fecha.slice(0, 7) === key).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const flujo = flujoMes(s, hoy, cfg.saldoDisponible);

  root.innerHTML = `
    <div class="row between wrap"><div><h2>Ingresos</h2><p class="muted">Ingreso mensual esperado <strong>${money(ingresoBase(s.ingresosRec))}</strong></p></div>
    <button class="btn primary" id="nuevo">+ Ingreso recurrente</button></div>
    ${s.ingresosRec.length ? `<div class="cards">${s.ingresosRec.map((i) => `<div class="card">
      <div class="row between"><h3>${esc(i.nombre)}</h3><button class="btn ghost" data-edit="${esc(i.id)}" aria-label="Editar">✎</button></div>
      <p class="big in">${money(i.monto)}</p><p class="muted">Día ${i.diaPago} · ${i.frecuencia}${i.activo === 'no' ? ' · inactivo' : ''}</p>
      <button class="btn primary" data-cobro="${esc(i.id)}">Me pagaron</button></div>`).join('')}</div>`
    : '<p class="card muted">Registra tu sueldo (monto y día de pago) para proyectar tu flujo del mes y medir tu riesgo.</p>'}
    <div class="card"><h3>Proyección de flujo de ${esc(hoy.slice(0, 7))}</h3>
      ${cfg.saldoDisponible > 0 ? '' : '<p class="muted">Define tu <a href="#/ajustes">saldo disponible</a> para que la proyección parta de tu dinero real.</p>'}
      ${flowHTML(flujo)}</div>
    ${monthNavHTML()}
    <div class="card"><h3>Ingresos registrados · ${money(monthTotals(s.movimientos, key).ingresos)}</h3>${ingresos.length
      ? `<ul class="list">${ingresos.map((m) => `<li><span>${esc(m.servicio || m.categoria)}<br><small class="muted">${dateCell(m.fecha)}</small></span><strong class="in">+${money(m.monto)}</strong></li>`).join('')}</ul>`
      : '<p class="muted">Sin ingresos registrados este mes.</p>'}</div>`;
  bindMonthNav(root, () => render(root));
  const byId = (id) => getState().ingresosRec.find((i) => i.id === id);
  root.querySelector('#nuevo').onclick = () => ingModal();
  root.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => ingModal(byId(b.dataset.edit))));
  root.querySelectorAll('[data-cobro]').forEach((b) => b.addEventListener('click', () => cobroModal(byId(b.dataset.cobro))));
}
