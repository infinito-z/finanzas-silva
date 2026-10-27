// Funciones puras: sin DOM ni almacenamiento, probadas en tests/risk.test.mjs
import { addMonths, daysInMonth } from './format.js';
import { DEUDA_CAT } from './schema.js';

export const monthOf = (s) => String(s).slice(0, 7);
const sum = (a) => a.reduce((x, y) => x + y, 0);

export function monthTotals(movs, key) {
  let ingresos = 0;
  let gastos = 0;
  for (const m of movs) {
    if (monthOf(m.fecha) !== key) continue;
    if (m.tipo === 'ingreso') ingresos += m.monto;
    else gastos += m.monto;
  }
  return { ingresos, gastos, balance: ingresos - gastos };
}

export function spendByCategory(movs, key) {
  const out = {};
  for (const m of movs) {
    if (m.tipo === 'ingreso' || monthOf(m.fecha) !== key) continue;
    out[m.categoria] = (out[m.categoria] || 0) + m.monto;
  }
  return out;
}

export function budgetStatus(categorias, movs, key, alertaPct = 80) {
  const spent = spendByCategory(movs, key);
  return categorias.map((c) => {
    const gastado = spent[c.nombre] || 0;
    const pct = c.presupuesto > 0 ? (gastado / c.presupuesto) * 100 : null;
    const nivel = pct == null ? 'ok' : pct >= 100 ? 'over' : pct >= alertaPct ? 'warn' : 'ok';
    return { ...c, gastado, pct, nivel };
  });
}

function byService(movs, key) {
  const out = {};
  for (const m of movs) {
    if (m.tipo === 'ingreso' || m.categoria === DEUDA_CAT || monthOf(m.fecha) !== key) continue;
    const name = (m.servicio || m.categoria || 'Sin nombre').trim();
    const k = name.toLowerCase();
    out[k] = out[k] || { nombre: name, monto: 0 };
    out[k].monto += m.monto;
  }
  return out;
}

export function topServices(movs, key, n = 8) {
  return Object.values(byService(movs, key)).sort((a, b) => b.monto - a.monto).slice(0, n);
}

// Servicios/comercios con gasto inusual: sube vs. promedio de 3 meses o concentra mucho del gasto.
export function serviceAlerts(movs, key, { variacion = 30, concentracion = 25, minMonto = 50 } = {}) {
  const cur = byService(movs, key);
  const prev = [1, 2, 3].map((n) => byService(movs, addMonths(key, -n)));
  const total = sum(Object.values(cur).map((s) => s.monto));
  const alerts = [];
  for (const [k, s] of Object.entries(cur)) {
    if (s.monto < minMonto) continue;
    const hist = prev.map((p) => p[k]?.monto || 0).filter((v) => v > 0);
    if (hist.length) {
      const avg = sum(hist) / hist.length;
      if (s.monto > avg * (1 + variacion / 100)) {
        alerts.push({ tipo: 'variacion', servicio: s.nombre, actual: s.monto, promedio: avg, subida: (s.monto / avg - 1) * 100 });
        continue;
      }
    }
    if (total > 0 && (s.monto / total) * 100 >= concentracion) {
      alerts.push({ tipo: 'concentracion', servicio: s.nombre, actual: s.monto, porcentaje: (s.monto / total) * 100 });
    }
  }
  return alerts.sort((a, b) => b.actual - a.actual);
}

export function nextDueDate(diaPago, todayStr) {
  const [y, m, d] = todayStr.split('-').map(Number);
  let key = `${y}-${String(m).padStart(2, '0')}`;
  if (diaPago < d) key = addMonths(key, 1);
  const day = Math.min(diaPago, daysInMonth(key));
  return `${key}-${String(day).padStart(2, '0')}`;
}

export const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000);

export function upcomingDues(deudas, todayStr, days = 7) {
  return deudas
    .filter((d) => d.saldo > 0 && d.diaPago > 0)
    .map((d) => {
      const fecha = nextDueDate(d.diaPago, todayStr);
      return { id: d.id, nombre: d.acreedor, monto: Math.min(d.cuota, d.saldo), fecha, dias: daysBetween(todayStr, fecha) };
    })
    .filter((d) => d.dias <= days)
    .sort((a, b) => a.dias - b.dias);
}

// Calendario de pagos de una deuda (tasa anual en %). extra = pago adicional mensual.
export function amortization(deuda, extra = 0) {
  const r = deuda.tasa / 1200;
  let saldo = deuda.saldo;
  let interes = 0;
  const schedule = [];
  for (let mes = 1; mes <= 600 && saldo > 0.005; mes++) {
    const i = saldo * r;
    const pago = Math.min(deuda.cuota + extra, saldo + i);
    if (pago <= i && mes === 1) return { meses: null, interes: null, schedule: [] };
    saldo = saldo + i - pago;
    interes += i;
    schedule.push({ mes, pago, interes: i, capital: pago - i, saldo: Math.max(saldo, 0) });
  }
  return { meses: schedule.length, interes, schedule };
}

// Simula pagar todas las deudas; el dinero liberado se reasigna (bola de nieve / avalancha).
export function payoffPlan(deudas, extra = 0, strategy = 'avalancha') {
  const ds = deudas.filter((d) => d.saldo > 0).map((d) => ({ nombre: d.acreedor, saldo: d.saldo, r: d.tasa / 1200, cuota: d.cuota }));
  if (!ds.length) return { meses: 0, interes: 0, orden: [] };
  const presupuesto = sum(ds.map((d) => d.cuota)) + extra;
  let interes = 0;
  let meses = 0;
  const orden = [];
  const done = new Set();
  while (ds.some((d) => d.saldo > 0.005) && meses < 600) {
    meses++;
    for (const d of ds) {
      const i = d.saldo * d.r;
      d.saldo += i;
      interes += i;
    }
    let pool = presupuesto;
    for (const d of ds) {
      const p = Math.min(d.cuota, d.saldo);
      d.saldo -= p;
      pool -= p;
    }
    const vivas = ds.filter((d) => d.saldo > 0.005).sort((a, b) => (strategy === 'bola-de-nieve' ? a.saldo - b.saldo : b.r - a.r));
    for (const t of vivas) {
      if (pool <= 0) break;
      const p = Math.min(pool, t.saldo);
      t.saldo -= p;
      pool -= p;
    }
    for (const d of ds) {
      if (d.saldo <= 0.005 && !done.has(d)) {
        done.add(d);
        orden.push({ nombre: d.nombre, mes: meses });
      }
    }
  }
  return { meses: meses >= 600 ? null : meses, interes, orden };
}

export function ingresoBase(ingresosRec) {
  return sum(ingresosRec.filter((i) => i.activo !== 'no').map((i) => i.monto * (i.frecuencia === 'quincenal' ? 2 : 1)));
}

// Línea de tiempo del mes: pagos de sueldo y cuotas que faltan, con saldo acumulado.
export function flujoMes(state, todayStr, saldoDisponible = 0) {
  const key = monthOf(todayStr);
  const day = Number(todayStr.slice(8));
  const dim = daysInMonth(key);
  const eventos = [];
  const delMes = state.movimientos.filter((m) => monthOf(m.fecha) === key);

  for (const ing of state.ingresosRec.filter((i) => i.activo !== 'no')) {
    const dias = ing.frecuencia === 'quincenal' ? [ing.diaPago, Math.min(ing.diaPago + 15, dim)] : [ing.diaPago];
    const cobrados = delMes.filter((m) => m.ingresoRecId === ing.id).length;
    dias.forEach((dia, idx) => {
      const dd = Math.min(dia, dim);
      if (idx >= cobrados && dd >= day) eventos.push({ dia: dd, nombre: ing.nombre, monto: ing.monto });
    });
  }
  for (const d of state.deudas.filter((x) => x.saldo > 0 && x.diaPago > 0)) {
    if (state.pagosDeuda.some((p) => p.deudaId === d.id && monthOf(p.fecha) === key)) continue;
    const dd = Math.min(d.diaPago, dim);
    eventos.push({ dia: Math.max(dd, day), nombre: `Cuota ${d.acreedor}${dd < day ? ' (vencida)' : ''}`, monto: -Math.min(d.cuota, d.saldo) });
  }
  const variable = sum(delMes.filter((m) => m.tipo !== 'ingreso' && m.categoria !== DEUDA_CAT).map((m) => m.monto));
  const resto = dim - day;
  if (resto > 0 && variable > 0) eventos.push({ dia: dim, nombre: 'Gasto variable estimado', monto: -(variable / day) * resto, estimado: true });

  eventos.sort((a, b) => a.dia - b.dia || b.monto - a.monto);
  let saldo = saldoDisponible;
  let minimo = saldo;
  for (const e of eventos) {
    saldo += e.monto;
    e.saldoDespues = saldo;
    minimo = Math.min(minimo, saldo);
  }
  return { inicio: saldoDisponible, eventos, minimo, final: saldo };
}

export function riskScore({ ingreso, gasto, cuotas, saldoDisponible, deudas }) {
  const factores = [];
  const add = (nombre, valor, puntos, detalle) => factores.push({ nombre, valor, puntos, detalle });
  const recomendaciones = [];

  if (ingreso > 0) {
    const r = (cuotas / ingreso) * 100;
    const p = r < 20 ? 0 : r < 35 ? 15 : r < 50 ? 30 : 40;
    add('Cuotas de deuda / ingreso', `${Math.round(r)}%`, p, 'Ideal: menos de 20% de tu ingreso en cuotas.');
    if (p >= 30) recomendaciones.push('Tus cuotas consumen demasiado ingreso: evita nuevas deudas y prioriza pagar la de mayor tasa.');

    const g = (gasto / ingreso) * 100;
    const pg = g < 70 ? 0 : g < 90 ? 10 : g < 100 ? 20 : 30;
    add('Gasto / ingreso', `${Math.round(g)}%`, pg, 'Ideal: gastar menos de 70% para poder ahorrar.');
    if (pg >= 20) recomendaciones.push('Gastas casi todo (o más) de lo que ganas: revisa las categorías en rojo en Presupuestos.');
  } else {
    add('Ingreso mensual', 'No configurado', 10, 'Registra tu sueldo en Ingresos para medir el riesgo con precisión.');
  }

  if (gasto > 0) {
    const meses = saldoDisponible / gasto;
    const p = meses >= 3 ? 0 : meses >= 1 ? 10 : 20;
    add('Colchón de emergencia', `${meses.toFixed(1)} meses`, p, 'Ideal: 3 a 6 meses de gastos disponibles.');
    if (p >= 10) recomendaciones.push('Construye un fondo de emergencia de al menos 3 meses de gasto.');
  }

  const cara = deudas.filter((d) => d.saldo > 0 && d.tasa >= 40);
  if (cara.length) {
    add('Deudas con tasa alta (≥40% anual)', cara.map((d) => d.acreedor).join(', '), 10, 'Los intereses altos crecen rápido.');
    recomendaciones.push(`Prioriza pagar ${cara[0].acreedor}: su tasa es de ${cara[0].tasa}% anual.`);
  }

  const score = Math.min(100, sum(factores.map((f) => f.puntos)));
  const nivel = score < 25 ? 'bajo' : score < 55 ? 'medio' : 'alto';
  if (!recomendaciones.length) recomendaciones.push('Tus indicadores están sanos. Mantén el hábito de registrar tus movimientos.');
  return { score, nivel, factores, recomendaciones };
}

export function riskInputs(state, todayStr, cfg) {
  const key = monthOf(todayStr);
  const { ingresos, gastos } = monthTotals(state.movimientos, key);
  const prev = [1, 2, 3].map((n) => monthTotals(state.movimientos, addMonths(key, -n))).filter((t) => t.gastos > 0);
  const gastoRef = Math.max(gastos, prev.length ? sum(prev.map((t) => t.gastos)) / prev.length : 0);
  const base = ingresoBase(state.ingresosRec);
  const vivas = state.deudas.filter((d) => d.saldo > 0);
  return {
    ingreso: base || ingresos,
    gasto: gastoRef,
    cuotas: sum(vivas.map((d) => d.cuota)),
    saldoDisponible: cfg.saldoDisponible,
    deudas: vivas,
  };
}

export function collectAlerts(state, todayStr, cfg) {
  const key = monthOf(todayStr);
  const out = [];
  const push = (nivel, titulo, detalle) => out.push({ nivel, titulo, detalle });

  for (const b of budgetStatus(state.categorias, state.movimientos, key, cfg.alertaPct)) {
    if (b.nivel === 'over') push('danger', `Superaste el presupuesto de ${b.nombre}`, `Gastado ${Math.round(b.pct)}% del límite.`);
    else if (b.nivel === 'warn') push('warn', `${b.nombre} va al ${Math.round(b.pct)}% del presupuesto`, 'Cuidado con lo que queda del mes.');
  }
  for (const a of serviceAlerts(state.movimientos, key, { variacion: cfg.variacionServicio, concentracion: cfg.concentracionServicio })) {
    if (a.tipo === 'variacion') push('warn', `Gasto alto en ${a.servicio}`, `+${Math.round(a.subida)}% sobre tu promedio de los últimos meses.`);
    else push('warn', `${a.servicio} concentra ${Math.round(a.porcentaje)}% de tu gasto`, 'Un solo servicio pesa mucho en el mes.');
  }
  for (const d of upcomingDues(state.deudas, todayStr, 5)) {
    push(d.dias <= 2 ? 'danger' : 'warn', `Vence ${d.nombre}`, d.dias === 0 ? 'Vence hoy.' : `En ${d.dias} día(s).`);
  }
  const t = monthTotals(state.movimientos, key);
  // antes de cobrar no hay ingresos registrados: ahí avisa la proyección de flujo, no este mensaje
  if (t.ingresos > 0 && t.gastos > t.ingresos) push('danger', 'Este mes gastas más de lo que ingresa', `Déficit de ${(t.gastos - t.ingresos).toFixed(2)}.`);
  if (cfg.saldoDisponible > 0) {
    const f = flujoMes(state, todayStr, cfg.saldoDisponible);
    if (f.minimo < 0) push('danger', 'Tu saldo podría quedar en negativo este mes', 'Revisa la proyección de flujo.');
  }
  const rs = riskScore(riskInputs(state, todayStr, cfg));
  if (rs.nivel === 'alto') push('danger', 'Riesgo financiero alto', `Puntaje ${rs.score}/100.`);

  const order = { danger: 0, warn: 1, info: 2 };
  return out.sort((a, b) => order[a.nivel] - order[b.nivel]);
}
