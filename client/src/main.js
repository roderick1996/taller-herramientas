import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { Quasar, Notify, Dialog, Loading, Dark } from 'quasar';
import es from 'quasar/lang/es';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@quasar/extras/material-icons/material-icons.css';
import 'quasar/dist/quasar.css';
import './css/app.css';
import App from './App.vue';
import router from './router';

const app = createApp(App);
app.use(createPinia());
app.use(Quasar, {
  plugins: { Notify, Dialog, Loading, Dark },
  lang: es,
  config: { notify: { position: 'top-right', timeout: 3500, progress: true } },
});
Dark.set(localStorage.getItem('dark') === '1');
app.use(router);
app.mount('#app');
