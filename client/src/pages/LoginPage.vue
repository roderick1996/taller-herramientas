<template>
  <div class="login">
    <section class="hero">
      <div class="cinta" />
      <div class="hero-in">
        <div class="logo"><q-icon name="build" size="40px" /></div>
        <h1 class="titulo">Taller de Mecánica<br />Automotriz</h1>
        <p>Cada herramienta con su dueño temporal y su hora de regreso.</p>
        <ul>
          <li><q-icon name="notifications_active" /> Alerta cuando algo no se devuelve</li>
          <li><q-icon name="inventory_2" /> Stock del taller al día</li>
          <li><q-icon name="picture_as_pdf" /> Reportes listos para imprimir o abrir en Excel</li>
        </ul>
      </div>
    </section>
    <section class="lado">
      <q-form class="caja panel q-pa-lg" @submit="entrar">
        <div class="titulo text-h4">Ingresar</div>
        <div class="text-grey q-mb-md">Usa tu usuario del taller</div>
        <q-input v-model="usuario" outlined label="Usuario" autofocus autocomplete="username" :rules="[(v) => !!v || 'Escribe tu usuario']">
          <template #prepend><q-icon name="person" /></template>
        </q-input>
        <q-input v-model="password" outlined label="Contraseña" :type="ver ? 'text' : 'password'" autocomplete="current-password"
                 :rules="[(v) => !!v || 'Escribe tu contraseña']">
          <template #prepend><q-icon name="lock" /></template>
          <template #append>
            <q-icon :name="ver ? 'visibility_off' : 'visibility'" class="cursor-pointer" @click="ver = !ver" />
          </template>
        </q-input>
        <q-btn type="submit" unelevated no-caps size="lg" class="full-width q-mt-sm btn-amarillo" label="Ingresar" :loading="cargando" />
      </q-form>
    </section>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../stores/auth';

const router = useRouter();
const auth = useAuth();
const usuario = ref('');
const password = ref('');
const ver = ref(false);
const cargando = ref(false);

async function entrar() {
  cargando.value = true;
  try {
    await auth.login(usuario.value, password.value);
    router.replace('/');
  } catch { /* el aviso de error ya se mostró */ } finally {
    cargando.value = false;
  }
}
</script>

<style scoped>
.login { min-height: 100vh; display: grid; grid-template-columns: 1.1fr 1fr; background: var(--bg); }
.hero { position: relative; background: #1c232b; color: #fff; display: flex; flex-direction: column;
  background-image: radial-gradient(circle, #3a4652 2px, transparent 2.5px); background-size: 28px 28px; }
.hero .cinta { height: 14px; }
.hero-in { margin: auto; padding: 40px; max-width: 520px; }
.logo { width: 72px; height: 72px; border-radius: 12px; background: var(--q-accent); color: #1c232b; display: grid; place-items: center; }
h1 { font-size: 64px; line-height: 0.95; margin: 22px 0 14px; }
p { font-size: 18px; color: #b8c4d0; }
ul { list-style: none; padding: 0; margin: 26px 0 0; display: grid; gap: 12px; color: #dbe3ea; }
li .q-icon { color: var(--q-accent); margin-right: 8px; }
.lado { display: grid; place-items: center; padding: 24px; }
.caja { width: 100%; max-width: 420px; }
@media (max-width: 900px) { .login { grid-template-columns: 1fr; } .hero { display: none; } }
</style>
