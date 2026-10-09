import { date } from 'quasar';

export const fmt = (v, f = 'DD/MM/YYYY HH:mm') => (v ? date.formatDate(v, f) : '—');
export const toLocalInput = (d) => date.formatDate(d, 'YYYY-MM-DDTHH:mm');
export const codigoPrestamo = (id) => `P-${String(id).padStart(5, '0')}`;
export const col = (name, label, extra = {}) => ({ name, label, field: name, align: 'left', sortable: true, ...extra });

export function estadoInfo(p) {
  if (p.estado === 'devuelto') return { label: 'Devuelto', color: 'positive', icon: 'check_circle' };
  if (p.vencido) return { label: 'Vencido', color: 'negative', icon: 'warning' };
  return { label: 'Activo', color: 'primary', icon: 'schedule' };
}

export function atraso(min) {
  if (min < 60) return `${min} min`;
  if (min < 1440) return `${Math.floor(min / 60)} h ${min % 60} min`;
  return `${Math.floor(min / 1440)} d ${Math.floor((min % 1440) / 60)} h`;
}
