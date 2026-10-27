import { getConfig, setConfig, getConn, setConn, loadDemo, resetAll, exportJSON, importJSON } from '../store.js';
import { esc, todayISO } from '../format.js';
import { toast } from '../ui.js';
import * as sheets from '../sheets.js';

export function render(root) {
  const cfg = getConfig();
  const conn = getConn();
  root.innerHTML = `
    <h2>Ajustes</h2>
    <form class="card" id="fConn">
      <h3>Conexión con Google Sheets</h3>
      <p class="muted">Sigue la guía del README para publicar el Apps Script. Estado: <strong id="est">${esc(sheets.status.msg)}</strong></p>
      <label class="field"><span>URL de la aplicación web (termina en /exec)</span><input name="url" type="url" value="${esc(conn.url || '')}" placeholder="https://script.google.com/macros/s/…/exec"></label>
      <label class="field"><span>Token secreto (el mismo de las Propiedades del script)</span><input name="token" type="password" autocomplete="off" value="${esc(conn.token || '')}"></label>
      <div class="row"><button class="btn primary">Guardar y sincronizar</button><button type="button" class="btn" id="sync">Sincronizar ahora</button></div>
    </form>
    <form class="card" id="fCfg">
      <h3>Preferencias y alertas</h3>
      <label class="field"><span>Saldo disponible hoy (S/) — efectivo + cuentas</span><input name="saldoDisponible" type="number" min="0" step="any" value="${cfg.saldoDisponible}"></label>
      <label class="field"><span>Avisar cuando una categoría llegue a (% del presupuesto)</span><input name="alertaPct" type="number" min="10" max="100" value="${cfg.alertaPct}"></label>
      <label class="field"><span>Avisar si un servicio sube más de (% vs. su promedio de 3 meses)</span><input name="variacionServicio" type="number" min="5" value="${cfg.variacionServicio}"></label>
      <label class="field"><span>Avisar si un servicio concentra más de (% del gasto del mes)</span><input name="concentracionServicio" type="number" min="5" max="100" value="${cfg.concentracionServicio}"></label>
      <button class="btn primary">Guardar preferencias</button>
    </form>
    <div class="card">
      <h3>Datos</h3>
      <div class="row wrap">
        <button class="btn" id="demo">Cargar datos de ejemplo</button>
        <button class="btn" id="exp">Exportar respaldo (JSON)</button>
        <button class="btn" id="imp">Importar respaldo</button><input type="file" id="file" accept="application/json" hidden>
        <button class="btn danger" id="reset">Borrar todo</button>
      </div>
      <p class="muted">Los datos se guardan en tu navegador y, si conectaste Google Sheets, también en tu hoja.</p>
    </div>`;
  const $ = (s) => root.querySelector(s);

  $('#fConn').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    setConn({ url: String(f.get('url')).trim(), token: String(f.get('token')).trim() });
    const r = await sheets.sync();
    toast(r.ok ? 'Sincronizado con Google Sheets' : `No se pudo sincronizar: ${r.error}`, r.ok ? 'ok' : 'error');
    $('#est').textContent = sheets.status.msg;
  };
  $('#sync').onclick = async () => {
    const r = await sheets.sync();
    toast(r.ok ? 'Sincronizado' : `No se pudo sincronizar: ${r.error}`, r.ok ? 'ok' : 'error');
    $('#est').textContent = sheets.status.msg;
  };
  $('#fCfg').onsubmit = (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    setConfig(Object.fromEntries(Object.entries(f).map(([k, v]) => [k, Number(v)])));
    toast('Preferencias guardadas');
  };
  $('#demo').onclick = () => { if (confirm('Esto reemplaza tus movimientos, deudas e ingresos locales por datos de ejemplo. ¿Continuar?')) { loadDemo(); toast(`Datos de ejemplo cargados (${todayISO()})`); } };
  $('#exp').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([exportJSON()], { type: 'application/json' }));
    a.download = `finanzas-respaldo-${todayISO()}.json`;
    a.click();
  };
  $('#imp').onclick = () => $('#file').click();
  $('#file').onchange = async (e) => {
    try { importJSON(await e.target.files[0].text()); toast('Respaldo importado'); } catch { toast('Archivo inválido', 'error'); }
  };
  $('#reset').onclick = () => { if (confirm('¿Borrar TODOS los datos locales? (Tu hoja de Google no se toca hasta que sincronices)')) { resetAll(); toast('Datos borrados'); } };
}
