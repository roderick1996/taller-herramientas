<template>
  <div class="login-page-container">
    <div class="login-card">
      <!-- Escudo y Nombre Institucional -->
      <div class="institutional-header">
        <img :src="logoEsfm" alt="ESFM José David Berríos" class="esfm-main-logo" />
        <h2 class="institutional-title">ESFM "JOSÉ DAVID BERRÍOS"</h2>
      </div>

      <!-- Formulario de Acceso -->
      <q-form class="login-form" @submit="entrar">
        <div class="form-subtitle">Iniciar sesión - Taller de Mecánica Automotriz</div>

        <q-input 
          v-model="usuario" 
          outlined 
          dense
          label="Usuario" 
          autofocus 
          autocomplete="username" 
          :rules="[(v) => !!v || 'Escribe tu usuario']" 
          class="q-mb-sm"
        >
          <template #prepend><q-icon name="person" /></template>
        </q-input>

        <q-input 
          v-model="password" 
          outlined 
          dense
          label="Contraseña" 
          :type="ver ? 'text' : 'password'" 
          autocomplete="current-password"
          :rules="[(v) => !!v || 'Escribe tu contraseña']"
        >
          <template #prepend><q-icon name="lock" /></template>
          <template #append>
            <q-icon :name="ver ? 'visibility_off' : 'visibility'" class="cursor-pointer" @click="ver = !ver" />
          </template>
        </q-input>

        <q-btn 
          type="submit" 
          unelevated 
          no-caps 
          class="full-width q-mt-md btn-acceder" 
          label="Acceder" 
          :loading="cargando" 
        />

        <div class="login-footer q-mt-md text-center">
          <a href="#" @click.prevent="recuperarPassword" class="text-grey-7">¿Olvidé mi contraseña?</a>
        </div>
      </q-form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../stores/auth';

// Importación del escudo institucional desde assets
import logoEsfmImg from '@/assets/logo-esfm.png';
const logoEsfm = ref(logoEsfmImg);

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

function recuperarPassword() {
  // Acción para recuperación de contraseña si aplica
}
</script>

<style scoped>
.login-page-container {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(135deg, #1c232b 0%, #3a4652 100%);
  background-image: radial-gradient(circle, #4a5568 2px, transparent 2.5px);
  background-size: 28px 28px;
  padding: 20px;
}

.login-card {
  background: #ffffff;
  width: 100%;
  max-width: 420px;
  border-radius: 16px;
  box-shadow: 0 12px 35px rgba(0, 0, 0, 0.25);
  padding: 30px 25px;
  overflow: hidden;
}

.institutional-header {
  text-align: center;
  padding-bottom: 20px;
  border-bottom: 1px solid #edf2f7;
  margin-bottom: 20px;
}

.esfm-main-logo {
  width: 110px;
  height: 110px;
  object-fit: contain;
  margin-bottom: 12px;
}

.institutional-title {
  font-size: 1.15rem;
  font-weight: 800;
  color: #2d3748;
  margin: 0;
  letter-spacing: 0.5px;
}

.form-subtitle {
  font-size: 0.95rem;
  color: #4a5568;
  font-weight: 600;
  margin-bottom: 15px;
}

.btn-acceder {
  background-color: #4a5568;
  color: white;
  font-weight: 600;
  border-radius: 8px;
  padding: 10px 0;
  font-size: 1rem;
}

.btn-acceder:hover {
  background-color: #2d3748;
}

.login-footer a {
  font-size: 0.85rem;
  text-decoration: underline;
}

.login-footer a:hover {
  color: #2d3748;
}
</style>