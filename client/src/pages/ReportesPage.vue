<template>
  <q-page class="page">
    <div class="row q-col-gutter-md">
      <div class="col-12 col-md-4 col-lg-3">
        <div class="seccion">¿Qué reporte necesitas?</div>
        <q-list class="q-gutter-y-sm">
          <q-item v-for="r in reportes" :key="r.tipo" clickable v-ripple class="panel" :class="{ 'elegido': tipo === r.tipo }" @click="tipo = r.tipo">
            <q-item-section avatar><q-icon :name="r.icono" :color="tipo === r.tipo ? 'primary' : 'grey'" size="28px" /></q-item-section>
            <q-item-section>
              <q-item-label class="text-weight-bold">{{ r.titulo }}</q-item-label>
              <q-item-label caption>{{ r.desc }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </div>

      <div class="col-12 col-md-8 col-lg-9">
        <div class="panel q-pa-md q-mb-md">
          <div class="row q-col-gutter-sm items-center">
            <template v-if="actual.filtros">
              <div class="col-6 col-sm-3"><q-input v-model="desde" dense outlined type="date" label="Desde" stack-label clearable /></div>
              <div class="col-6 col-sm-3"><q-input v-model="hasta" dense outlined type="date" label="Hasta" stack-label clearable /></div>
              <div class="col-12 col-sm-3"><q-select v-model="curso" dense outlined emit-value map-options :options="cursos" label="Curso" /></div>
            </template>
            <div class="col" :class="actual.filtros ? '' : 'text-grey'">
              <div v-if="actual.filtros" class="q-gutter-xs">
                <q-chip clickable dense v-for="a in atajos" :key="a.l" :label="a.l" @click="a.fn" />
              </div>
              <div v-else>Este reporte muestra el estado actual del taller.</div>
            </div>
          </div>
          <div class="q-mt-md q-gutter-sm">
            <q-btn unelevated no-caps color="negative" icon="picture_as_pdf" label="Abrir PDF" :disable="!rep" @click="archivo(url('pdf'), params)" />
            <q-btn unelevated no-caps color="positive" icon="table_view" label="Descargar Excel" :disable="!rep" @click="archivo(url('xlsx'), params, { abrir: false, nombre: `${tipo}.xlsx` })" />
            <q-btn unelevated no-caps class="btn-amarillo" icon="print" label="Imprimir" :disable="!rep" @click="imprimir(url('pdf'), params)" />
          </div>
        </div>

        <div class="panel q-pa-sm">
          <q-table flat dense :rows="rep?.rows || []" :columns="columnas" row-key="n" :loading="cargando" :pagination="{ rowsPerPage: 12 }"
                   :rows-per-page-options="[12, 25, 50, 0]" no-data-label="No hay datos para este reporte">
            <template #top>
              <div>
                <div class="seccion q-mb-none">{{ rep?.title || actual.titulo }}</div>
                <div class="text-caption text-grey">{{ rep?.subtitle }}</div>
              </div>
              <q-space />
              <div v-if="rep" class="text-caption text-grey text-right">{{ (rep.resumen || []).join('  ·  ') }}</div>
            </template>
            <template #body-cell-estado="s">
              <q-td :props="s"><q-badge :color="color(s.value)" :label="s.value" /></q-td>
            </template>
          </q-table>
        </div>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { date } from 'quasar';
import { api, archivo, imprimir } from '../api';

const reportes = [
  { tipo: 'prestamos', icono: 'history', titulo: 'Historial de préstamos', desc: 'Quién se prestó qué, con qué responsable y en qué estado', filtros: true },
  { tipo: 'uso', icono: 'trending_up', titulo: 'Herramientas utilizadas', desc: 'Cuántas veces y cuántas unidades se usó cada herramienta', filtros: true },
  { tipo: 'pendientes', icono: 'report_problem', titulo: 'Herramientas que faltan', desc: 'Lo que sigue fuera del taller y quién lo tiene', filtros: true },
  { tipo: 'inventario', icono: 'inventory_2', titulo: 'Inventario', desc: 'Total, disponibles y prestadas de cada herramienta', filtros: false },
];
const tipo = ref('prestamos');
const desde = ref(date.formatDate(date.subtractFromDate(new Date(), { days: 30 }), 'YYYY-MM-DD'));
const hasta = ref('');
const curso = ref(null);
const cursos = ref([{ label: 'Todos los cursos', value: null }]);
const rep = ref(null);
const cargando = ref(false);

const actual = computed(() => reportes.find((r) => r.tipo === tipo.value));
const params = computed(() => (actual.value.filtros ? Object.fromEntries(Object.entries({ desde: desde.value, hasta: hasta.value, curso_id: curso.value }).filter(([, v]) => v)) : {}));
const url = (fmt) => `/reportes/${tipo.value}/${fmt}`;
const columnas = computed(() => (rep.value?.columns || []).map((c) => ({ name: c.key, label: c.header, field: c.key, align: c.align || 'left', sortable: true })));
const color = (v) => ({ VENCIDO: 'negative', Devuelto: 'positive', Activo: 'primary', 'En plazo': 'primary', bueno: 'positive', regular: 'warning', malo: 'negative' }[v] || 'grey');

const hoy = () => date.formatDate(new Date(), 'YYYY-MM-DD');
const atajos = [
  { l: 'Hoy', fn: () => { desde.value = hoy(); hasta.value = hoy(); } },
  { l: '7 días', fn: () => { desde.value = date.formatDate(date.subtractFromDate(new Date(), { days: 7 }), 'YYYY-MM-DD'); hasta.value = ''; } },
  { l: 'Este mes', fn: () => { desde.value = date.formatDate(date.startOfDate(new Date(), 'month'), 'YYYY-MM-DD'); hasta.value = ''; } },
  { l: 'Todo', fn: () => { desde.value = ''; hasta.value = ''; } },
];

let espera;
async function cargar() {
  cargando.value = true;
  try { rep.value = (await api.get(url('json'), { params: params.value })).data; } finally { cargando.value = false; }
}
watch([tipo, desde, hasta, curso], () => { clearTimeout(espera); espera = setTimeout(cargar, 250); });
onMounted(async () => {
  cursos.value.push(...(await api.get('/cursos')).data.map((c) => ({ label: c.nombre, value: c.id })));
  cargar();
});
</script>

<style scoped>
.elegido { border-color: var(--q-primary); box-shadow: inset 4px 0 0 var(--q-accent); }
</style>
