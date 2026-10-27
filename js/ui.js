import { esc, todayISO, monthLabel, addMonths, money, fmtDate } from './format.js';

export const session = { month: todayISO().slice(0, 7) };

// ---- gráficos (Chart.js por CDN; degrada con gracia si no carga) ----
const charts = [];
export function mkChart(canvas, cfg) {
  if (typeof Chart === 'undefined') {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = 'Gráfico no disponible (no se pudo cargar Chart.js).';
    canvas.replaceWith(p);
    return;
  }
  charts.push(new Chart(canvas, cfg));
}
export function destroyCharts() {
  charts.splice(0).forEach((c) => c.destroy());
}

export function toast(msg, kind = 'ok') {
  let box = document.getElementById('toasts');
  if (!box) {
    box = Object.assign(document.createElement('div'), { id: 'toasts' });
    document.body.append(box);
  }
  const t = document.createElement('div');
  t.className = `toast ${kind}`;
  t.textContent = msg;
  box.append(t);
  setTimeout(() => t.remove(), 3500);
}

// ---- navegación por mes ----
export const monthNavHTML = () => `
  <div class="monthnav">
    <button class="btn ghost" data-mn="-1" aria-label="Mes anterior">‹</button>
    <strong>${esc(monthLabel(session.month))}</strong>
    <button class="btn ghost" data-mn="1" aria-label="Mes siguiente">›</button>
  </div>`;
export function bindMonthNav(root, rerender) {
  root.querySelectorAll('[data-mn]').forEach((b) => b.addEventListener('click', () => {
    session.month = addMonths(session.month, Number(b.dataset.mn));
    rerender();
  }));
}

// ---- formularios modales ----
function fieldHTML(f, value) {
  const v = value ?? f.default ?? '';
  const req = f.required === false ? '' : 'required';
  const id = `f_${f.name}`;
  let input;
  if (f.type === 'select') {
    const opts = f.options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
    input = `<select id="${id}" name="${f.name}" ${req}>${opts.map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(v) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
  } else if (f.type === 'textarea') {
    input = `<textarea id="${id}" name="${f.name}" rows="2">${esc(v)}</textarea>`;
  } else {
    const list = f.list ? `list="${id}_l"` : '';
    const extra = f.type === 'number' ? `step="${f.step || 'any'}" min="${f.min ?? 0}" ${f.max ? `max="${f.max}"` : ''}` : '';
    input = `<input id="${id}" name="${f.name}" type="${f.type || 'text'}" value="${esc(v)}" ${extra} ${list} ${req} ${f.disabled ? 'disabled' : ''}>`;
    if (f.list) input += `<datalist id="${id}_l">${f.list.map((o) => `<option value="${esc(o)}">`).join('')}</datalist>`;
  }
  return `<label class="field"><span>${esc(f.label)}</span>${input}</label>`;
}

export function formModal({ title, fields, values = {}, submitLabel = 'Guardar', onSubmit, onDelete }) {
  const dlg = document.createElement('dialog');
  dlg.className = 'modal';
  dlg.innerHTML = `<form>
    <h3>${esc(title)}</h3>
    ${fields.map((f) => fieldHTML(f, values[f.name])).join('')}
    <div class="row end">
      ${onDelete ? '<button type="button" class="btn danger" data-del>Eliminar</button>' : ''}
      <span class="grow"></span>
      <button type="button" class="btn ghost" data-cancel>Cancelar</button>
      <button class="btn primary">${esc(submitLabel)}</button>
    </div></form>`;
  document.body.append(dlg);
  const close = () => { dlg.close(); dlg.remove(); };
  dlg.addEventListener('cancel', () => dlg.remove());
  dlg.querySelector('[data-cancel]').onclick = close;
  if (onDelete) dlg.querySelector('[data-del]').onclick = () => { if (confirm('¿Eliminar este registro?')) { onDelete(); close(); } };
  dlg.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const out = {};
    for (const f of fields) {
      const el = dlg.querySelector(`[name="${f.name}"]`);
      out[f.name] = f.type === 'number' ? Number(el.value) : el.value.trim();
    }
    onSubmit(out);
    close();
  });
  dlg.showModal();
}

// ---- piezas reutilizables ----
export function alertsHTML(list, vacio = 'Sin alertas. ¡Todo en orden!') {
  if (!list.length) return `<p class="muted">${esc(vacio)}</p>`;
  const icon = { danger: '⛔', warn: '⚠️', info: 'ℹ️' };
  return `<ul class="alerts">${list.map((a) => `<li class="alert ${a.nivel}"><span>${icon[a.nivel]}</span><div><strong>${esc(a.titulo)}</strong><div class="muted">${esc(a.detalle)}</div></div></li>`).join('')}</ul>`;
}

export function barHTML(pct, nivel) {
  const w = Math.min(100, Math.max(0, pct));
  return `<div class="bar" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><i class="${nivel}" style="width:${w}%"></i></div>`;
}

export function flowHTML(flujo) {
  if (!flujo.eventos.length) return '<p class="muted">No hay movimientos pendientes proyectados este mes.</p>';
  return `<table class="tbl"><thead><tr><th>Día</th><th>Concepto</th><th class="num">Monto</th><th class="num">Saldo</th></tr></thead><tbody>
    <tr class="muted"><td></td><td>Saldo disponible hoy</td><td></td><td class="num">${money(flujo.inicio)}</td></tr>
    ${flujo.eventos.map((e) => `<tr class="${e.saldoDespues < 0 ? 'neg' : ''}"><td>${e.dia}</td><td>${esc(e.nombre)}</td><td class="num ${e.monto < 0 ? 'out' : 'in'}">${money(e.monto)}</td><td class="num">${money(e.saldoDespues)}</td></tr>`).join('')}
  </tbody></table>`;
}

export const dateCell = (s) => esc(fmtDate(s));
