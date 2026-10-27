/**
 * Backend de Finanzas Silva: convierte tu Google Sheet en una API privada.
 *
 * Pasos (detalle en README.md):
 *  1. En tu hoja: Extensiones > Apps Script, pega este archivo.
 *  2. Configuración del proyecto > Propiedades del script > agrega TOKEN = una clave larga que inventes.
 *  3. Ejecuta inicializar() una vez (autoriza permisos).
 *  4. Implementar > Nueva implementación > Aplicación web
 *     (Ejecutar como: yo; Quién tiene acceso: Cualquier persona). Copia la URL en la app.
 *  5. (Opcional, Google Forms) Ejecuta crearTriggerFormulario() una vez.
 */

// Debe coincidir con js/schema.js
var SCHEMA = {
  movimientos: { sheet: 'Movimientos', cols: ['id', 'fecha', 'tipo', 'monto', 'categoria', 'servicio', 'nota', 'medio', 'ingresoRecId'] },
  categorias: { sheet: 'Categorias', cols: ['id', 'nombre', 'presupuesto', 'color'] },
  deudas: { sheet: 'Deudas', cols: ['id', 'acreedor', 'saldo', 'saldoInicial', 'tasa', 'cuota', 'diaPago', 'cuotasRestantes'] },
  pagosDeuda: { sheet: 'PagosDeuda', cols: ['id', 'deudaId', 'fecha', 'monto', 'interes'] },
  ingresosRec: { sheet: 'IngresosRecurrentes', cols: ['id', 'nombre', 'monto', 'diaPago', 'frecuencia', 'activo'] },
  config: { sheet: 'Config', cols: ['id', 'valor'] }
};
var FORM_SHEET = 'Respuestas'; // pestaña donde Google Forms guarda las respuestas

function doGet(e) {
  if (!authorized_(e.parameter && e.parameter.token)) return json_({ ok: false, error: 'No autorizado' });
  var data = {};
  Object.keys(SCHEMA).forEach(function (k) { data[k] = readTab_(k); });
  return json_({ ok: true, data: data });
}

function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'JSON inválido' }); }
  if (!authorized_(body.token)) return json_({ ok: false, error: 'No autorizado' });
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (body.action === 'batch') {
      (body.ops || []).forEach(function (op) {
        if (!SCHEMA[op.tab]) return;
        if (op.op === 'upsert') upsert_(op.tab, op.row);
        else if (op.op === 'delete') delete_(op.tab, op.id);
      });
      return json_({ ok: true });
    }
    if (body.action === 'importForm') return json_({ ok: true, importados: importarFormulario_() });
    return json_({ ok: false, error: 'Acción desconocida' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function authorized_(token) {
  var expected = PropertiesService.getScriptProperties().getProperty('TOKEN');
  return Boolean(expected) && token === expected;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sheet_(key) {
  var def = SCHEMA[key];
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(def.sheet);
  if (!sh) {
    sh = ss.insertSheet(def.sheet);
    sh.getRange(1, 1, 1, def.cols.length).setValues([def.cols]).setFontWeight('bold');
    sh.setFrozenRows(1);
    def.cols.forEach(function (c, i) {
      // las fechas y ids se guardan como texto para que Sheets no los reinterprete
      if (c === 'fecha' || c === 'id') sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1).setNumberFormat('@');
    });
  }
  return sh;
}

function inicializar() {
  Object.keys(SCHEMA).forEach(sheet_);
}

function cell_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return v;
}

function readTab_(key) {
  var sh = sheet_(key);
  var cols = SCHEMA[key].cols;
  var last = sh.getLastRow();
  if (last < 2) return [];
  var values = sh.getRange(2, 1, last - 1, cols.length).getValues();
  var rows = [];
  values.forEach(function (r) {
    if (r[0] === '' || r[0] === null) return;
    var o = {};
    cols.forEach(function (c, i) { o[c] = cell_(r[i]); });
    rows.push(o);
  });
  return rows;
}

function findRow_(sh, id) {
  var last = sh.getLastRow();
  if (last < 2) return -1;
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return -1;
}

function upsert_(key, row) {
  var sh = sheet_(key);
  var cols = SCHEMA[key].cols;
  var values = cols.map(function (c) { return row[c] === undefined ? '' : row[c]; });
  var r = findRow_(sh, row.id);
  if (r < 0) r = Math.max(sh.getLastRow(), 1) + 1;
  sh.getRange(r, 1, 1, cols.length).setValues([values]);
}

function delete_(key, id) {
  var sh = sheet_(key);
  var r = findRow_(sh, id);
  if (r > 0) sh.deleteRow(r);
}

// ---- Google Forms ----
// El Formulario debe tener preguntas llamadas (en cualquier orden):
// Fecha, Tipo (Gasto/Ingreso), Monto, Categoría, Servicio, Nota
function norm_(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function importarFormulario_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FORM_SHEET);
  if (!sh || sh.getLastRow() < 2) return 0;
  var lastCol = sh.getLastColumn();
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(norm_);
  var iImp = headers.indexOf('importado');
  if (iImp < 0) {
    iImp = lastCol;
    sh.getRange(1, iImp + 1).setValue('Importado').setFontWeight('bold');
    lastCol++;
  }
  function idx(re) { for (var i = 0; i < headers.length; i++) if (re.test(headers[i])) return i; return -1; }
  var ix = { ts: idx(/marca temporal|timestamp/), fecha: idx(/^fecha/), tipo: idx(/^tipo/), monto: idx(/^monto|importe/), cat: idx(/^categoria/), serv: idx(/^servicio|comercio/), nota: idx(/^nota|descripcion/) };
  var data = sh.getRange(2, 1, sh.getLastRow() - 1, lastCol).getValues();
  var tz = Session.getScriptTimeZone();
  var n = 0;
  data.forEach(function (r, i) {
    if (String(r[iImp]).toLowerCase() === 'si') return;
    var monto = parseFloat(String(ix.monto >= 0 ? r[ix.monto] : '').replace(/[^0-9.,-]/g, '').replace(',', '.'));
    if (!monto) return;
    var f = ix.fecha >= 0 && r[ix.fecha] ? r[ix.fecha] : (ix.ts >= 0 ? r[ix.ts] : new Date());
    var fecha = f instanceof Date ? Utilities.formatDate(f, tz, 'yyyy-MM-dd') : String(f).slice(0, 10);
    var tipo = ix.tipo >= 0 && norm_(r[ix.tipo]).indexOf('ingreso') === 0 ? 'ingreso' : 'gasto';
    upsert_('movimientos', {
      id: 'form-' + (i + 2) + '-' + new Date().getTime(),
      fecha: fecha, tipo: tipo, monto: monto,
      categoria: ix.cat >= 0 ? r[ix.cat] : 'Otros',
      servicio: ix.serv >= 0 ? r[ix.serv] : '',
      nota: ix.nota >= 0 ? r[ix.nota] : '',
      medio: 'Formulario', ingresoRecId: ''
    });
    sh.getRange(i + 2, iImp + 1).setValue('SI');
    n++;
  });
  return n;
}

// Trigger instalable: convierte cada respuesta del Formulario en un movimiento al instante
function alEnviarFormulario(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { importarFormulario_(); } finally { lock.releaseLock(); }
}

function crearTriggerFormulario() {
  ScriptApp.newTrigger('alEnviarFormulario').forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet()).onFormSubmit().create();
}
