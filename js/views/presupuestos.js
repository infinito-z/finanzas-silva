import { getState, getConfig, upsert, remove } from '../store.js';
import { money, esc, slug, pct } from '../format.js';
import { INGRESO_CATS, DEUDA_CAT } from '../schema.js';
import { budgetStatus, serviceAlerts, topServices, monthTotals } from '../risk.js';
import { session, monthNavHTML, bindMonthNav, formModal, barHTML, alertsHTML } from '../ui.js';

function catModal(c) {
  const nueva = !c;
  formModal({
    title: nueva ? 'Nueva categoría' : `Presupuesto: ${c.nombre}`,
    values: c || { color: '#3d85c6', presupuesto: 0 },
    fields: [
      ...(nueva ? [{ name: 'nombre', label: 'Nombre' }] : []),
      { name: 'presupuesto', label: 'Presupuesto mensual (S/, 0 = sin límite)', type: 'number', min: 0 },
      { name: 'color', label: 'Color', type: 'color' },
    ],
    onSubmit: (v) => upsert('categorias', nueva ? { id: slug(v.nombre), ...v } : { ...c, ...v }),
    onDelete: nueva ? undefined : () => remove('categorias', c.id),
  });
}

export function render(root) {
  const s = getState();
  const cfg = getConfig();
  const key = session.month;
  const lista = budgetStatus(s.categorias.filter((c) => !INGRESO_CATS.includes(c.nombre)), s.movimientos, key, cfg.alertaPct);
  const totalPres = lista.reduce((t, c) => t + c.presupuesto, 0);
  const t = monthTotals(s.movimientos, key);
  const svc = serviceAlerts(s.movimientos, key, { variacion: cfg.variacionServicio, concentracion: cfg.concentracionServicio });
  const top = topServices(s.movimientos, key);
  const nivelTxt = { ok: 'ok', warn: 'warn', over: 'danger' };

  root.innerHTML = `
    <div class="row between wrap">${monthNavHTML()}<button class="btn primary" id="nueva">+ Categoría</button></div>
    <div class="card">
      <h3>Presupuesto por categoría</h3>
      ${totalPres > 0 ? `<p class="muted">Presupuestado: ${money(totalPres)} · Gastado: ${money(t.gastos)}</p>` : '<p class="muted">Toca ✎ en una categoría para fijar su presupuesto mensual y recibir alertas.</p>'}
      <ul class="list budgets">${lista.map((c) => `<li>
        <div class="row between"><span><i class="dot" style="background:${esc(c.color)}"></i>${esc(c.nombre)}</span>
          <span>${money(c.gastado)}${c.presupuesto > 0 ? ` / ${money(c.presupuesto)} · <strong class="${nivelTxt[c.nivel]}">${pct(c.pct)}</strong>` : ''}
          ${c.nombre === DEUDA_CAT ? '' : `<button class="btn ghost" data-cat="${esc(c.id)}" aria-label="Editar ${esc(c.nombre)}">✎</button>`}</span></div>
        ${c.presupuesto > 0 ? barHTML(c.pct, nivelTxt[c.nivel]) : ''}</li>`).join('')}</ul>
    </div>
    <div class="grid2">
      <div class="card"><h3>Servicios con gasto alto</h3>${alertsHTML(svc.map((a) => (a.tipo === 'variacion'
        ? { nivel: 'warn', titulo: `${a.servicio}: ${money(a.actual)}`, detalle: `+${Math.round(a.subida)}% sobre su promedio (${money(a.promedio)}).` }
        : { nivel: 'warn', titulo: `${a.servicio}: ${money(a.actual)}`, detalle: `Concentra ${Math.round(a.porcentaje)}% de tu gasto del mes.` })), 'Ningún servicio fuera de lo normal.')}</div>
      <div class="card"><h3>Dónde se va tu dinero</h3>${top.length
        ? `<ul class="list">${top.map((x) => `<li><span>${esc(x.nombre)}</span><strong>${money(x.monto)}</strong></li>`).join('')}</ul>` : '<p class="muted">Sin gastos este mes.</p>'}</div>
    </div>`;
  bindMonthNav(root, () => render(root));
  root.querySelector('#nueva').onclick = () => catModal();
  root.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => catModal(getState().categorias.find((c) => c.id === b.dataset.cat))));
}
