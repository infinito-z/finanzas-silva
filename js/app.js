import * as store from './store.js';
import * as sheets from './sheets.js';
import { destroyCharts } from './ui.js';
import { movimientoModal } from './views/movimientos.js';
import * as dashboard from './views/dashboard.js';
import * as movimientos from './views/movimientos.js';
import * as presupuestos from './views/presupuestos.js';
import * as deudas from './views/deudas.js';
import * as ingresos from './views/ingresos.js';
import * as riesgos from './views/riesgos.js';
import * as ajustes from './views/ajustes.js';

const VIEWS = {
  dashboard: ['Resumen', dashboard], movimientos: ['Movimientos', movimientos], presupuestos: ['Presupuestos', presupuestos],
  deudas: ['Deudas', deudas], ingresos: ['Ingresos', ingresos], riesgos: ['Riesgos', riesgos], ajustes: ['Ajustes', ajustes],
};
const root = document.getElementById('view');
const nav = document.getElementById('nav');
nav.innerHTML = Object.entries(VIEWS).map(([k, [label]]) => `<a href="#/${k}" data-k="${k}">${label}</a>`).join('');

function current() {
  const k = location.hash.replace('#/', '');
  return VIEWS[k] ? k : 'dashboard';
}

function draw() {
  const k = current();
  nav.querySelectorAll('a').forEach((a) => a.classList.toggle('active', a.dataset.k === k));
  destroyCharts();
  VIEWS[k][1].render(root);
  const st = document.getElementById('sync-status');
  st.textContent = sheets.status.estado === 'local' ? '● Local' : `● ${sheets.status.msg}`;
  st.className = `sync ${sheets.status.estado}`;
}

window.addEventListener('hashchange', draw);
store.subscribe((kind) => {
  if (kind === 'local' && sheets.configured()) sheets.scheduleSync();
  // ajustes tiene formularios en edición: no se redibuja por cambios remotos
  if (!(kind === 'remote' && current() === 'ajustes')) draw();
});
document.getElementById('quick-add').addEventListener('click', () => movimientoModal());
window.addEventListener('online', () => sheets.configured() && sheets.sync().then(draw));

draw();
if (sheets.configured()) sheets.sync().then(draw);
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
