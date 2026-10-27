import test from 'node:test';
import assert from 'node:assert/strict';
import { budgetStatus, serviceAlerts, nextDueDate, amortization, payoffPlan, riskScore, flujoMes, upcomingDues, monthTotals } from '../js/risk.js';

const g = (fecha, monto, categoria, servicio) => ({ id: fecha + servicio + monto, fecha, tipo: 'gasto', monto, categoria, servicio });

test('monthTotals separa ingresos y gastos', () => {
  const t = monthTotals([{ fecha: '2026-10-01', tipo: 'ingreso', monto: 100 }, g('2026-10-02', 40, 'X', 'a'), g('2026-09-02', 99, 'X', 'a')], '2026-10');
  assert.deepEqual(t, { ingresos: 100, gastos: 40, balance: 60 });
});

test('budgetStatus marca warn al 80% y over al 100%', () => {
  const cats = [{ nombre: 'A', presupuesto: 100 }, { nombre: 'B', presupuesto: 100 }, { nombre: 'C', presupuesto: 100 }, { nombre: 'D', presupuesto: 0 }];
  const movs = [g('2026-10-01', 50, 'A', 'x'), g('2026-10-01', 85, 'B', 'x'), g('2026-10-01', 120, 'C', 'x'), g('2026-10-01', 999, 'D', 'x')];
  assert.deepEqual(budgetStatus(cats, movs, '2026-10', 80).map((b) => b.nivel), ['ok', 'warn', 'over', 'ok']);
});

test('serviceAlerts detecta subida sobre promedio de 3 meses', () => {
  const movs = [g('2026-07-05', 100, 'S', 'Luz'), g('2026-08-05', 100, 'S', 'Luz'), g('2026-09-05', 100, 'S', 'Luz'), g('2026-10-05', 180, 'S', 'Luz'), g('2026-10-06', 5000, 'V', 'Alquiler'), g('2026-09-06', 5000, 'V', 'Alquiler')];
  const a = serviceAlerts(movs, '2026-10', { variacion: 30, concentracion: 99 });
  assert.equal(a.length, 1);
  assert.equal(a[0].servicio, 'Luz');
  assert.equal(Math.round(a[0].subida), 80);
});

test('serviceAlerts detecta concentración y excluye pagos de deuda', () => {
  const movs = [g('2026-10-05', 800, 'Ocio', 'Casino'), g('2026-10-06', 100, 'Otros', 'Tienda'), g('2026-10-07', 9000, 'Deudas', 'Banco')];
  const a = serviceAlerts(movs, '2026-10', { concentracion: 25 });
  assert.deepEqual(a.map((x) => [x.servicio, x.tipo]), [['Casino', 'concentracion']]);
});

test('nextDueDate pasa al mes siguiente y ajusta fin de mes', () => {
  assert.equal(nextDueDate(15, '2026-10-10'), '2026-10-15');
  assert.equal(nextDueDate(5, '2026-10-10'), '2026-11-05');
  assert.equal(nextDueDate(31, '2026-01-31'), '2026-01-31');
  assert.equal(nextDueDate(30, '2026-02-10'), '2026-02-28');
});

test('upcomingDues filtra por días', () => {
  const ds = [{ id: 1, acreedor: 'A', saldo: 100, cuota: 50, diaPago: 12 }, { id: 2, acreedor: 'B', saldo: 100, cuota: 50, diaPago: 25 }, { id: 3, acreedor: 'C', saldo: 0, cuota: 50, diaPago: 11 }];
  assert.deepEqual(upcomingDues(ds, '2026-10-10', 5).map((d) => [d.nombre, d.dias]), [['A', 2]]);
});

test('amortization sin interés = saldo/cuota meses; cuota insuficiente = null', () => {
  assert.equal(amortization({ saldo: 1000, tasa: 0, cuota: 250 }).meses, 4);
  assert.equal(amortization({ saldo: 1000, tasa: 120, cuota: 50 }).meses, null);
  const a = amortization({ saldo: 1000, tasa: 12, cuota: 100 });
  assert.ok(a.interes > 0 && a.schedule.at(-1).saldo === 0);
});

test('avalancha paga menos interés que bola de nieve cuando la deuda cara es la grande', () => {
  const ds = [{ acreedor: 'Chica', saldo: 500, tasa: 10, cuota: 50 }, { acreedor: 'Cara', saldo: 5000, tasa: 60, cuota: 200 }];
  const av = payoffPlan(ds, 200, 'avalancha');
  const bn = payoffPlan(ds, 200, 'bola-de-nieve');
  assert.ok(av.interes < bn.interes);
  assert.equal(bn.orden[0].nombre, 'Chica');
  assert.equal(payoffPlan([], 0).meses, 0);
});

test('riskScore: sano = bajo, sobreendeudado = alto', () => {
  const sano = riskScore({ ingreso: 5000, gasto: 2500, cuotas: 300, saldoDisponible: 10000, deudas: [] });
  assert.equal(sano.nivel, 'bajo');
  const mal = riskScore({ ingreso: 3000, gasto: 3100, cuotas: 1800, saldoDisponible: 100, deudas: [{ acreedor: 'Visa', saldo: 1, tasa: 60 }] });
  assert.equal(mal.nivel, 'alto');
  assert.ok(mal.score <= 100);
});

test('flujoMes ordena eventos, omite lo ya cobrado/pagado y detecta saldo negativo', () => {
  const state = {
    movimientos: [g('2026-10-02', 300, 'Alimentación', 'Wong')],
    ingresosRec: [{ id: 'i1', nombre: 'Sueldo', monto: 3000, diaPago: 28, frecuencia: 'mensual', activo: 'si' }],
    deudas: [{ id: 'd1', acreedor: 'Visa', saldo: 5000, cuota: 400, diaPago: 15 }, { id: 'd2', acreedor: 'Pagada', saldo: 5000, cuota: 100, diaPago: 20 }],
    pagosDeuda: [{ deudaId: 'd2', fecha: '2026-10-03', monto: 100 }],
  };
  const f = flujoMes(state, '2026-10-10', 200);
  assert.deepEqual(f.eventos.map((e) => e.nombre.split(' ')[0]), ['Cuota', 'Sueldo', 'Gasto']);
  assert.equal(f.eventos[0].saldoDespues, -200);
  assert.ok(f.minimo < 0);
});
