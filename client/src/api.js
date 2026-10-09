import axios from 'axios';
import { Notify } from 'quasar';

export const api = axios.create({ baseURL: '/api', timeout: 30000 });

api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem('token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

api.interceptors.response.use((r) => r, async (err) => {
  let msg = err.response?.data?.error;
  if (err.response?.data instanceof Blob) {
    try { msg = JSON.parse(await err.response.data.text()).error; } catch { /* sin detalle */ }
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

/** Abre (PDF) o descarga (Excel) un archivo generado por el servidor */
export async function archivo(url, params = {}, { abrir = true, nombre = 'reporte' } = {}) {
  const { data } = await api.get(url, { params, responseType: 'blob' });
  const href = URL.createObjectURL(data);
  if (abrir) {
    if (!window.open(href, '_blank')) Notify.create({ type: 'warning', message: 'Permite las ventanas emergentes para ver el PDF' });
  } else {
    const a = document.createElement('a');
    a.href = href;
    a.download = nombre;
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(href), 60000);
}

/** Manda el PDF directo a la impresora */
export async function imprimir(url, params = {}) {
  const { data } = await api.get(url, { params, responseType: 'blob' });
  const href = URL.createObjectURL(data);
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  f.src = href;
  f.onload = () => {
    try { f.contentWindow.focus(); f.contentWindow.print(); } catch { window.open(href, '_blank'); }
  };
  document.body.appendChild(f);
  setTimeout(() => { f.remove(); URL.revokeObjectURL(href); }, 180000);
}
