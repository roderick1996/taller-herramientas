import { defineStore } from 'pinia';
import { Notify } from 'quasar';
import { api } from '../api';

export const useAlertas = defineStore('alertas', {
  state: () => ({ lista: [], timer: null, ultimo: 0 }),
  getters: {
    cantidad: (s) => s.lista.length,
    herramientas: (s) => s.lista.reduce((a, x) => a + x.pendientes, 0),
  },
  actions: {
    async cargar() {
      try {
        const { data } = await api.get('/alertas', { headers: { 'x-silencioso': 1 } });
        if (data.length > this.ultimo) this.avisar(data);
        this.ultimo = data.length;
        this.lista = data;
      } catch { /* sin conexión: se reintenta */ }
    },
    avisar(data) {
      Notify.create({
        type: 'negative', icon: 'notifications_active', timeout: 9000,
        message: `${data.length} préstamo(s) sin devolver a tiempo`,
        caption: 'Hay herramientas que faltan en el taller',
        actions: [{ label: 'Ver', color: 'white', handler: () => { window.location.hash = '#/prestamos?estado=vencido'; } }],
      });
      this.pitido();
    },
    pitido() {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        [0, 0.28].forEach((t) => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.type = 'square'; o.frequency.value = 760;
          o.connect(g); g.connect(ctx.destination);
          g.gain.setValueAtTime(0.08, ctx.currentTime + t);
          o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.16);
        });
      } catch { /* el navegador bloqueó el audio */ }
    },
    iniciar() {
      this.detener();
      this.cargar();
      this.timer = setInterval(() => this.cargar(), 45000);
    },
    detener() {
      clearInterval(this.timer);
      this.timer = null;
      this.ultimo = 0;
      this.lista = [];
    },
  },
});
