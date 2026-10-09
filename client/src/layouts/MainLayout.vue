<template>
  <q-layout view="lHh LpR lFf">
    <q-header class="app-header">
      <q-toolbar style="min-height: 60px">
        <q-btn flat round dense icon="menu" @click="drawer = !drawer" />
        <div class="titulo text-h5 q-ml-sm">{{ $route.meta.titulo }}</div>
        <q-space />

        <q-btn flat round dense :icon="$q.dark.isActive ? 'light_mode' : 'dark_mode'" @click="cambiarTema">
          <q-tooltip>Cambiar tema</q-tooltip>
        </q-btn>

        <q-btn flat round dense icon="notifications" class="q-mx-xs" :class="{ pulso: alertas.cantidad }">
          <q-badge v-if="alertas.cantidad" color="negative" floating rounded>{{ alertas.cantidad }}</q-badge>
          <q-menu anchor="bottom right" self="top right" style="width: 380px; max-width: 94vw">
            <div class="q-pa-md">
              <div class="seccion">Herramientas sin devolver</div>
              <div v-if="!alertas.cantidad" class="text-grey">Todo está en orden: no hay préstamos vencidos.</div>
              <q-list v-else separator>
                <q-item v-for="a in alertas.lista.slice(0, 6)" :key="a.id" clickable v-close-popup to="/prestamos?estado=vencido">
                  <q-item-section>
                    <q-item-label class="text-weight-bold">{{ a.estudiante }}</q-item-label>
                    <q-item-label caption lines="2">{{ a.detalle }}</q-item-label>
                    <q-item-label caption class="text-negative">Atrasado {{ atraso(a.minutos_atraso) }} · {{ a.curso }}</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </div>
          </q-menu>
        </q-btn>

        <q-btn flat no-caps dense class="q-ml-sm">
          <q-avatar size="34px" color="secondary" text-color="accent" class="text-weight-bold">{{ inicial }}</q-avatar>
          <div class="gt-xs q-ml-sm text-left">
            <div class="text-weight-bold" style="line-height: 1.1">{{ auth.user?.nombre }}</div>
            <div class="text-caption text-grey">{{ auth.isAdmin ? 'Administrador' : 'Responsable' }}</div>
          </div>
          <q-menu>
            <q-list style="min-width: 170px">
              <q-item clickable v-close-popup @click="salir">
                <q-item-section avatar><q-icon name="logout" /></q-item-section>
                <q-item-section>Cerrar sesión</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </q-toolbar>
    </q-header>

    <q-drawer v-model="drawer" show-if-above :width="250" class="app-drawer">
      <div class="cinta" />
      <div class="marca">
        <div class="logo"><q-icon name="build" size="26px" /></div>
        <div>
          <div class="nombre">Taller ESFM</div>
          <div class="sub">Mecánica Automotriz</div>
        </div>
      </div>
      <q-list class="q-mt-sm">
        <q-item v-for="n in menu" :key="n.to" :to="n.to" :exact="n.to === '/'" clickable v-ripple
                class="nav-item" :class="{ 'nav-nuevo': n.nuevo }" active-class="nav-activo">
          <q-item-section avatar><q-icon :name="n.icon" /></q-item-section>
          <q-item-section>{{ n.label }}</q-item-section>
          <q-item-section v-if="n.to === '/prestamos' && alertas.cantidad" side>
            <q-badge color="negative" rounded>{{ alertas.cantidad }}</q-badge>
          </q-item-section>
        </q-item>
      </q-list>
      <q-space />
      <div class="q-pa-md text-caption" style="color: #6f8091">3 cursos · 35 estudiantes por curso</div>
    </q-drawer>

    <q-page-container>
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in"><component :is="Component" /></transition>
      </router-view>
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useQuasar } from 'quasar';
import { useRouter } from 'vue-router';
import { useAuth } from '../stores/auth';
import { useAlertas } from '../stores/alertas';
import { atraso } from '../utils';

const $q = useQuasar();
const router = useRouter();
const auth = useAuth();
const alertas = useAlertas();
const drawer = ref(false);

const inicial = computed(() => (auth.user?.nombre || '?').charAt(0).toUpperCase());
const menu = computed(() => [
  { to: '/', icon: 'space_dashboard', label: 'Panel' },
  { to: '/prestamo/nuevo', icon: 'add_circle', label: 'Nuevo préstamo', nuevo: true },
  { to: '/prestamos', icon: 'swap_horiz', label: 'Préstamos' },
  { to: '/herramientas', icon: 'handyman', label: 'Herramientas' },
  { to: '/estudiantes', icon: 'groups', label: 'Estudiantes' },
  { to: '/responsables', icon: 'badge', label: 'Responsables' },
  { to: '/reportes', icon: 'summarize', label: 'Reportes' },
  ...(auth.isAdmin ? [{ to: '/usuarios', icon: 'admin_panel_settings', label: 'Usuarios' }] : []),
]);

function cambiarTema() {
  $q.dark.toggle();
  localStorage.setItem('dark', $q.dark.isActive ? '1' : '0');
}
function salir() {
  alertas.detener();
  auth.logout();
  router.replace('/login');
}
onMounted(() => alertas.iniciar());
onBeforeUnmount(() => alertas.detener());
</script>
