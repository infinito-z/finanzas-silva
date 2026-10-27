// Columnas de cada pestaña. Deben coincidir con SCHEMA en apps-script/Code.gs.
export const SCHEMA = {
  movimientos: { sheet: 'Movimientos', cols: ['id', 'fecha', 'tipo', 'monto', 'categoria', 'servicio', 'nota', 'medio', 'ingresoRecId'], num: ['monto'] },
  categorias: { sheet: 'Categorias', cols: ['id', 'nombre', 'presupuesto', 'color'], num: ['presupuesto'] },
  deudas: { sheet: 'Deudas', cols: ['id', 'acreedor', 'saldo', 'saldoInicial', 'tasa', 'cuota', 'diaPago', 'cuotasRestantes'], num: ['saldo', 'saldoInicial', 'tasa', 'cuota', 'diaPago', 'cuotasRestantes'] },
  pagosDeuda: { sheet: 'PagosDeuda', cols: ['id', 'deudaId', 'fecha', 'monto', 'interes'], num: ['monto', 'interes'] },
  ingresosRec: { sheet: 'IngresosRecurrentes', cols: ['id', 'nombre', 'monto', 'diaPago', 'frecuencia', 'activo'], num: ['monto', 'diaPago'] },
  config: { sheet: 'Config', cols: ['id', 'valor'], num: [] },
};

export const DEFAULT_CONFIG = {
  alertaPct: 80, // % del presupuesto que dispara aviso
  variacionServicio: 30, // % sobre el promedio de 3 meses que dispara aviso
  concentracionServicio: 25, // % del gasto mensual en un solo servicio
  saldoDisponible: 0, // dinero hoy en cuentas/efectivo
};

export const INGRESO_CATS = ['Sueldo', 'Otros ingresos'];
export const DEUDA_CAT = 'Deudas';
export const MEDIOS = ['Efectivo', 'Tarjeta de crédito', 'Tarjeta de débito', 'Yape/Plin', 'Transferencia'];

export const DEFAULT_CATEGORIES = [
  ['Alimentación', '#e07a5f'], ['Transporte', '#3d85c6'], ['Vivienda', '#81b29a'],
  ['Servicios', '#f2cc8f'], ['Salud', '#d62828'], ['Educación', '#6a4c93'],
  ['Entretenimiento', '#f4a261'], ['Suscripciones', '#2a9d8f'], ['Deudas', '#6d6875'],
  ['Otros', '#8d99ae'], ['Sueldo', '#2d9d5c'], ['Otros ingresos', '#52b788'],
];
