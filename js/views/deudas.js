import { getState, upsert, remove, pagarDeuda } from '../store.js';
import { money, esc, todayISO, pct } from '../format.js';
import { nextDueDate, daysBetween, amortization, payoffPlan } from '../risk.js';
import { formModal, barHTML, toast, dateCell } from '../ui.js';

let extra = 0;

function deudaModal(d) {
  formModal({
    title: d ? `Editar ${d.acreedor}` : 'Nueva deuda',
    values: d || { diaPago: 15, tasa: 0 },
    fields: [
      { name: 'acreedor', label: 'Acreedor (banco, tarjeta, persona)' },
      { name: 'saldo', label: 'Saldo pendiente (S/)', type: 'number' },
      { name: 'saldoInicial', label: 'Monto original (S/)', type: 'number', required: false },
      { name: 'tasa', label: 'Tasa anual (TEA %)', type: 'number' },
      { name: 'cuota', label: 'Cuota mensual (S/)', type: 'number' },
      { name: 'diaPago', label: 'Día de pago (1-31)', type: 'number', min: 1, max: 31 },
      { name: 'cuotasRestantes', label: 'Cuotas restantes', type: 'number' },
    ],
    onSubmit: (v) => upsert('deudas', { ...d, ...v, saldoInicial: v.saldoInicial || v.saldo }),
    onDelete: d ? () => remove('deudas', d.id) : undefined,
  });
}

function pagoModal(d) {
  formModal({
    title: `Pagar a ${d.acreedor}`,
    values: { fecha: todayISO(), monto: Math.min(d.cuota, d.saldo) },
    fields: [{ name: 'monto', label: 'Monto pagado (S/)', type: 'number', min: 0.01 }, { name: 'fecha', label: 'Fecha', type: 'date' }],
    submitLabel: 'Registrar pago',
    onSubmit: (v) => { pagarDeuda(d.id, v.fecha, v.monto); toast('Pago registrado (también se anotó como gasto)'); },
  });
}

function calendarioModal(d) {
  const a = amortization(d, extra);
  const dlg = document.createElement('dialog');
  dlg.className = 'modal wide';
  dlg.innerHTML = `<h3>Calendario: ${esc(d.acreedor)}</h3>
    ${a.meses == null ? '<p class="out">Con esta cuota los intereses superan el pago: la deuda nunca baja. Sube la cuota.</p>'
    : `<p>${a.meses} meses · intereses totales <strong>${money(a.interes)}</strong>${extra ? ` (con +${money(extra)} extra al mes)` : ''}</p>
    <div class="scroll"><table class="tbl"><thead><tr><th>Mes</th><th class="num">Pago</th><th class="num">Interés</th><th class="num">Capital</th><th class="num">Saldo</th></tr></thead><tbody>
    ${a.schedule.slice(0, 36).map((r) => `<tr><td>${r.mes}</td><td class="num">${money(r.pago)}</td><td class="num">${money(r.interes)}</td><td class="num">${money(r.capital)}</td><td class="num">${money(r.saldo)}</td></tr>`).join('')}
    </tbody></table></div>${a.schedule.length > 36 ? '<p class="muted">Se muestran los primeros 36 meses.</p>' : ''}`}
    <div class="row end"><button class="btn primary" data-close>Cerrar</button></div>`;
  document.body.append(dlg);
  dlg.querySelector('[data-close]').onclick = () => { dlg.close(); dlg.remove(); };
  dlg.addEventListener('cancel', () => dlg.remove());
  dlg.showModal();
}

export function render(root) {
  const { deudas } = getState();
  const hoy = todayISO();
  const vivas = deudas.filter((d) => d.saldo > 0);
  const totalSaldo = vivas.reduce((t, d) => t + d.saldo, 0);
  const totalCuotas = vivas.reduce((t, d) => t + d.cuota, 0);
  const av = payoffPlan(vivas, extra, 'avalancha');
  const bn = payoffPlan(vivas, extra, 'bola-de-nieve');
  const plan = (p, nombre, desc) => `<div class="card"><h4>${nombre}</h4><p class="muted">${desc}</p>
    ${p.meses == null ? '<p class="out">No se liquida con estas cuotas.</p>' : `<p><strong>${p.meses}</strong> meses · intereses <strong>${money(p.interes)}</strong></p>
    <ol>${p.orden.map((o) => `<li>${esc(o.nombre)} (mes ${o.mes})</li>`).join('')}</ol>`}</div>`;

  root.innerHTML = `
    <div class="row between wrap"><div><h2>Deudas</h2><p class="muted">Total adeudado <strong>${money(totalSaldo)}</strong> · cuotas al mes <strong>${money(totalCuotas)}</strong></p></div>
    <button class="btn primary" id="nueva">+ Deuda</button></div>
    ${deudas.length ? '' : '<p class="card muted">No tienes deudas registradas. Agrega tarjetas, préstamos o pagos a terceros para ver vencimientos y estrategias de pago.</p>'}
    <div class="cards">${deudas.map((d) => {
    const prog = d.saldoInicial > 0 ? ((d.saldoInicial - d.saldo) / d.saldoInicial) * 100 : 0;
    const f = d.saldo > 0 ? nextDueDate(d.diaPago, hoy) : null;
    const dias = f ? daysBetween(hoy, f) : null;
    return `<div class="card debt">
        <div class="row between"><h3>${esc(d.acreedor)}</h3><button class="btn ghost" data-edit="${esc(d.id)}" aria-label="Editar">✎</button></div>
        <p class="big out">${money(d.saldo)}</p>
        ${barHTML(prog, 'ok')}<p class="muted">${pct(prog)} pagado · TEA ${d.tasa}% · ${d.cuotasRestantes} cuotas restantes</p>
        <p>${f ? `Próximo pago: <strong>${dateCell(f)}</strong> (${dias === 0 ? 'hoy' : `en ${dias} días`}) · ${money(Math.min(d.cuota, d.saldo))}` : '<strong class="in">¡Deuda saldada!</strong>'}</p>
        <div class="row">${d.saldo > 0 ? `<button class="btn primary" data-pay="${esc(d.id)}">Registrar pago</button>` : ''}<button class="btn" data-cal="${esc(d.id)}">Calendario</button></div></div>`;
  }).join('')}</div>
    ${vivas.length ? `<div class="card"><h3>Estrategia de pago</h3>
      <label class="field inline"><span>Dinero extra al mes para deudas (S/)</span><input id="extra" type="number" min="0" step="10" value="${extra}"></label>
      <div class="grid2">${plan(av, 'Avalancha', 'Primero la de mayor tasa: menos intereses.')}${plan(bn, 'Bola de nieve', 'Primero la de menor saldo: victorias rápidas.')}</div></div>` : ''}`;

  const byId = (id) => getState().deudas.find((d) => d.id === id);
  root.querySelector('#nueva').onclick = () => deudaModal();
  root.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => deudaModal(byId(b.dataset.edit))));
  root.querySelectorAll('[data-pay]').forEach((b) => b.addEventListener('click', () => pagoModal(byId(b.dataset.pay))));
  root.querySelectorAll('[data-cal]').forEach((b) => b.addEventListener('click', () => calendarioModal(byId(b.dataset.cal))));
  const ex = root.querySelector('#extra');
  if (ex) ex.onchange = () => { extra = Math.max(0, Number(ex.value) || 0); render(root); };
}
