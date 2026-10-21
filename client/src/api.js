import axios from 'axios';
import { Notify } from 'quasar';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000
});

api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem('token');
  if (t) cfg.headers.Authorization = `Bearer ` + t;
  return cfg;
});

api.interceptors.response.use((r) => r, async (err) => {
  let msg = err.response?.data?.error;
  if (err.response?.data instanceof Blob) {
    try { msg = JSON.parse(await err.response.data.text()).error; } catch {}
  }
  if (err.response?.status === 401 && !err.config.url.includes('/auth/login')) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.hash = '#/login';
    window.location.reload();
  }
  if (!err.config?.headers?.['x-silencioso']) {
    Notify.create({ type: 'negative', icon: 'error', message: msg || 'No se pudo conectar con el servidor' });
  }
  return Promise.reject(err);
});

export async function archivo(url, nombre = 'archivo', params) {
  const r = await api.get(url, { params, responseType: 'blob' });
  const href = URL.createObjectURL(r.data);
  const a = document.createElement('a');
  a.href = href;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10000);
}

export async function imprimir(url, params) {
  const r = await api.get(url, { params, responseType: 'blob' });
  const href = URL.createObjectURL(r.data);
  const w = window.open(href, '_blank');
  if (w) w.addEventListener('load', () => w.print());
}