const fmt = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });

export const money = (n) => fmt.format(Number(n) || 0);
export const pct = (n) => `${Math.round(n)}%`;
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const todayISO = () => iso(new Date());

export function fmtDate(s) {
  if (!s) return '';
  return new Date(`${String(s).slice(0, 10)}T00:00:00`).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  const t = new Date(y, m - 1, 1).toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function addMonths(key, n) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function daysInMonth(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
