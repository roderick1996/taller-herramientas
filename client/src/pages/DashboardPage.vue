<template>
  <q-page class="page">
    <div class="row items-center q-mb-md">
      <div>
        <div class="titulo text-h4">Hola, {{ auth.user?.nombre?.split(' ')[0] }}</div>
        <div class="text-grey" style="text-transform: capitalize">{{ hoy }}</div>
      </div>
      <q-space />
      <q-btn unelevated no-caps size="lg" class="btn-amarillo" icon="add_circle" label="Nuevo préstamo" to="/prestamo/nuevo" />
    </div>

    <template v-if="d">
      <q-banner v-if="d.prestamos.vencidos" class="alerta-banner q-mb-md">
        <template #avatar><q-icon name="notifications_active" color="accent" size="34px" /></template>
        <div class="titulo text-h6">
          {{ d.prestamos.vencidos }} préstamo(s) no se devolvieron a tiempo · faltan {{ faltan }} herramienta(s)
        </div>
        <div class="text-grey-5">Revisa quién las tiene y registra la devolución cuando regresen.</div>
        <template #action><q-btn unelevated no-caps class="btn-amarillo" label="Ver vencidos" to="/prestamos?estado=vencido" /></template>
      </q-banner>

      <div class="kpis">
        <StatCard v-for="k in kpis" :key="k.label" v-bind="k" />
      </div>

      <div class="row q-col-gutter-md q-mt-xs">
        <div class="col-12 col-lg-8">
          <div class="panel q-pa-md">
            <div class="seccion">Préstamos de los últimos 14 días</div>
            <div style="height: 270px"><Bar :data="dataDias" :options="opcionesDias" /></div>
          </div>
        </div>
        <div class="col-12 col-lg-4">
          <div class="panel q-pa-md">
            <div class="seccion">Préstamos por curso (30 días)</div>
            <div style="height: 270px"><Doughnut :data="dataCursos" :options="opcionesCursos" /></div>
          </div>
        </div>
        <div class="col-12 col-lg-5">
          <div class="panel q-pa-md">
            <div class="seccion">Herramientas más usadas (30 días)</div>
            <div v-if="!d.top.length" class="text-grey q-pa-md">Aún no hay préstamos registrados.</div>
            <div v-else style="height: 300px"><Bar :data="dataTop" :options="opcionesTop" /></div>
          </div>
        </div>
        <div class="col-12 col-lg-7">
          <div class="panel q-pa-md">
            <div class="seccion">Quién debe herramientas</div>
            <div v-if="!d.vencidos.length" class="row items-center text-positive q-pa-md">
              <q-icon name="verified" size="28px" class="q-mr-sm" /> Todo está al día, nadie tiene herramientas vencidas.
            </div>
            <q-list v-else separator>
              <q-item v-for="v in d.vencidos" :key="v.id" clickable v-ripple @click="abrir(v.id)">
                <q-item-section>
                  <q-item-label class="text-weight-bold">{{ v.estudiante }} <span class="text-caption text-grey">· {{ v.curso }}</span></q-item-label>
                  <q-item-label caption lines="2">{{ v.detalle }}</q-item-label>
                  <q-item-label caption>Presta: {{ v.responsable }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-badge color="negative" :label="`Atraso ${atraso(v.minutos_atraso)}`" />
                  <div class="text-caption q-mt-xs">{{ v.pendientes }} sin devolver</div>
                </q-item-section>
              </q-item>
            </q-list>
          </div>
        </div>
      </div>
    </template>
    <div v-else class="flex flex-center q-pa-xl"><q-spinner-gears size="48px" color="primary" /></div>

    <PrestamoDialog v-model="dlg" :prestamo-id="sel" @actualizado="cargar" />
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useQuasar, date } from 'quasar';
import { Bar, Doughnut } from 'vue-chartjs';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend, Filler } from 'chart.js';
import StatCard from '../components/StatCard.vue';
import PrestamoDialog from '../components/PrestamoDialog.vue';
import { api } from '../api';
import { useAuth } from '../stores/auth';
import { useAlertas } from '../stores/alertas';
import { atraso } from '../utils';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend, Filler);

const $q = useQuasar();
const auth = useAuth();
const alertas = useAlertas();
const d = ref(null);
const dlg = ref(false);
const sel = ref(null);
let timer;

const hoy = date.formatDate(new Date(), 'dddd D [de] MMMM [de] YYYY');
const faltan = computed(() => d.value.vencidos.reduce((a, x) => a + x.pendientes, 0));

async function cargar() {
  d.value = (await api.get('/dashboard')).data;
  alertas.cargar();
}
const abrir = (id) => { sel.value = id; dlg.value = true; };
onMounted(() => { cargar(); timer = setInterval(cargar, 30000); });
onBeforeUnmount(() => clearInterval(timer));

const kpis = computed(() => {
  const { inventario: i, prestamos: p } = d.value;
  return [
    { label: 'Tipos de herramienta', valor: i.tipos, icono: 'handyman', color: '#2d5f8b' },
    { label: 'Unidades en el taller', valor: i.total, icono: 'inventory_2', color: '#5b6b7a' },
    { label: 'Disponibles ahora', valor: i.disponibles, icono: 'check_circle', color: '#2f9e63' },
    { label: 'Fuera del taller', valor: i.total - i.disponibles, icono: 'output', color: '#e8890c' },
    { label: 'Préstamos activos', valor: p.activos, icono: 'swap_horiz', color: '#3b82b8' },
    { label: 'Vencidos', valor: p.vencidos, icono: 'alarm', color: '#d93a2b', pulso: p.vencidos > 0 },
    { label: 'Préstamos de hoy', valor: p.hoy, icono: 'today', color: '#ffbe0b' },
  ];
});

const texto = computed(() => ($q.dark.isActive ? '#8fa0b0' : '#5b6b7a'));
const lineas = computed(() => ($q.dark.isActive ? '#2c3844' : '#dde3e9'));
const base = computed(() => ({ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: texto.value, usePointStyle: true } } } }));
const ejes = (extra = {}) => ({ x: { ticks: { color: texto.value }, grid: { display: false } }, y: { beginAtZero: true, ticks: { color: texto.value, precision: 0 }, grid: { color: lineas.value } }, ...extra });

const dataDias = computed(() => ({
  labels: d.value.dias.map((x) => x.dia),
  datasets: [
    { type: 'bar', label: 'Préstamos', data: d.value.dias.map((x) => x.prestamos), backgroundColor: '#2d5f8b', borderRadius: 4 },
    { type: 'line', label: 'Herramientas prestadas', data: d.value.dias.map((x) => x.unidades), borderColor: '#ffbe0b', backgroundColor: 'rgba(255,190,11,.18)', fill: true, tension: 0.3, pointBackgroundColor: '#ffbe0b' },
  ],
}));
const opcionesDias = computed(() => ({ ...base.value, scales: ejes() }));

const dataCursos = computed(() => ({
  labels: d.value.cursos.map((x) => x.nombre),
  datasets: [{ data: d.value.cursos.map((x) => x.prestamos), backgroundColor: ['#2d5f8b', '#ffbe0b', '#2f9e63'], borderWidth: 0 }],
}));
const opcionesCursos = computed(() => ({ ...base.value, cutout: '62%' }));

const dataTop = computed(() => ({
  labels: d.value.top.map((x) => x.nombre),
  datasets: [{ label: 'Unidades prestadas', data: d.value.top.map((x) => x.unidades), backgroundColor: '#2d5f8b', borderRadius: 4 }],
}));
const opcionesTop = computed(() => ({ ...base.value, indexAxis: 'y', plugins: { legend: { display: false } },
  scales: { x: { beginAtZero: true, ticks: { color: texto.value, precision: 0 }, grid: { color: lineas.value } }, y: { ticks: { color: texto.value }, grid: { display: false } } } }));
</script>
