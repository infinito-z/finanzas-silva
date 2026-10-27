import { getState, getConfig } from '../store.js';
import { todayISO, esc } from '../format.js';
import { riskScore, riskInputs, collectAlerts, flujoMes } from '../risk.js';
import { alertsHTML, flowHTML, barHTML } from '../ui.js';

export function render(root) {
  const s = getState();
  const cfg = getConfig();
  const hoy = todayISO();
  const r = riskScore(riskInputs(s, hoy, cfg));
  const tono = { bajo: 'ok', medio: 'warn', alto: 'danger' }[r.nivel];
  root.innerHTML = `
    <h2>Riesgos</h2>
    <div class="card risk-${r.nivel}">
      <p class="muted">Nivel de riesgo financiero</p>
      <p class="big">${r.nivel.toUpperCase()} · ${r.score}/100</p>
      ${barHTML(r.score, tono)}
    </div>
    <div class="grid2">
      <div class="card"><h3>Qué lo explica</h3><table class="tbl"><tbody>
        ${r.factores.map((f) => `<tr><td>${esc(f.nombre)}<br><small class="muted">${esc(f.detalle)}</small></td><td class="num">${esc(f.valor)}<br><small class="${f.puntos ? 'out' : 'in'}">+${f.puntos} pts</small></td></tr>`).join('')}
      </tbody></table></div>
      <div class="card"><h3>Recomendaciones</h3><ul>${r.recomendaciones.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
    </div>
    <div class="card"><h3>Alertas activas</h3>${alertsHTML(collectAlerts(s, hoy, cfg))}</div>
    <div class="card"><h3>Proyección de flujo del mes</h3>${cfg.saldoDisponible > 0 ? '' : '<p class="muted">Define tu saldo disponible en Ajustes para activar las alertas de flujo negativo.</p>'}${flowHTML(flujoMes(s, hoy, cfg.saldoDisponible))}</div>`;
}
