import { getState, getConfig } from '../store.js';
import { money, todayISO, addMonths, monthLabel, esc, fmtDate } from '../format.js';
import { monthTotals, spendByCategory, collectAlerts, riskScore, riskInputs, upcomingDues } from '../risk.js';
import { session, monthNavHTML, bindMonthNav, mkChart, alertsHTML } from '../ui.js';

export function render(root) {
  const s = getState();
  const cfg = getConfig();
  const hoy = todayISO();
  const key = session.month;
  const t = monthTotals(s.movimientos, key);
  const riesgo = riskScore(riskInputs(s, hoy, cfg));
  const alertas = collectAlerts(s, hoy, cfg);
  const dues = upcomingDues(s.deudas, hoy, 30).slice(0, 5);
  const ahorroPct = t.ingresos > 0 ? Math.round((t.balance / t.ingresos) * 100) : null;

  root.innerHTML = `
    ${monthNavHTML()}
    <section class="kpis">
      <div class="card kpi"><span class="muted">Ingresos</span><strong class="in">${money(t.ingresos)}</strong></div>
      <div class="card kpi"><span class="muted">Gastos</span><strong class="out">${money(t.gastos)}</strong></div>
      <div class="card kpi"><span class="muted">Balance${ahorroPct != null ? ` · ahorro ${ahorroPct}%` : ''}</span><strong class="${t.balance < 0 ? 'out' : 'in'}">${money(t.balance)}</strong></div>
      <a class="card kpi risk-${riesgo.nivel}" href="#/riesgos"><span class="muted">Riesgo financiero</span><strong>${riesgo.nivel.toUpperCase()} · ${riesgo.score}/100</strong></a>
    </section>
    <section class="grid2">
      <div class="card"><h3>Gasto por categoría</h3><div class="chart"><canvas id="cCat"></canvas></div></div>
      <div class="card"><h3>Últimos 6 meses</h3><div class="chart"><canvas id="cTrend"></canvas></div></div>
    </section>
    <section class="grid2">
      <div class="card"><h3>Alertas</h3>${alertsHTML(alertas.slice(0, 6))}${alertas.length > 6 ? '<a href="#/riesgos">Ver todas</a>' : ''}</div>
      <div class="card"><h3>Próximos vencimientos</h3>${dues.length
        ? `<ul class="list">${dues.map((d) => `<li><span>${esc(d.nombre)}<br><small class="muted">${esc(fmtDate(d.fecha))} · ${d.dias === 0 ? 'hoy' : `en ${d.dias} día(s)`}</small></span><strong>${money(d.monto)}</strong></li>`).join('')}</ul>`
        : '<p class="muted">Sin deudas por vencer. Agrégalas en la pestaña Deudas.</p>'}</div>
    </section>
    ${s.movimientos.length ? '' : '<p class="card muted">Aún no hay datos. Registra tu primer movimiento o carga datos de ejemplo en <a href="#/ajustes">Ajustes</a>.</p>'}`;
  bindMonthNav(root, () => render(root));

  const cats = spendByCategory(s.movimientos, key);
  const names = Object.keys(cats);
  const color = (n) => s.categorias.find((c) => c.nombre === n)?.color || '#8d99ae';
  if (names.length) {
    mkChart(root.querySelector('#cCat'), {
      type: 'doughnut',
      data: { labels: names, datasets: [{ data: names.map((n) => cats[n]), backgroundColor: names.map(color) }] },
      options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } },
    });
  } else root.querySelector('#cCat').replaceWith(Object.assign(document.createElement('p'), { className: 'muted', textContent: 'Sin gastos este mes.' }));

  const meses = [-5, -4, -3, -2, -1, 0].map((n) => addMonths(key, n));
  const tot = meses.map((m) => monthTotals(s.movimientos, m));
  mkChart(root.querySelector('#cTrend'), {
    type: 'bar',
    data: {
      labels: meses.map((m) => monthLabel(m).split(' ')[0].slice(0, 3)),
      datasets: [
        { label: 'Ingresos', data: tot.map((x) => x.ingresos), backgroundColor: '#2d9d5c' },
        { label: 'Gastos', data: tot.map((x) => x.gastos), backgroundColor: '#d9534f' },
      ],
    },
    options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } },
  });
}
