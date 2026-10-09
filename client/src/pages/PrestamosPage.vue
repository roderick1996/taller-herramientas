<template>
  <q-page class="page">
    <div class="panel q-pa-md q-mb-md">
      <div class="row q-col-gutter-sm items-center">
        <div class="col-12 col-md-3"><q-input v-model="f.q" dense outlined debounce="300" placeholder="Estudiante, CI o responsable"><template #prepend><q-icon name="search" /></template></q-input></div>
        <div class="col-6 col-md-2"><q-select v-model="f.estado" dense outlined emit-value map-options :options="estados" label="Estado" /></div>
        <div class="col-6 col-md-2"><q-select v-model="f.curso_id" dense outlined emit-value map-options :options="cursos" label="Curso" /></div>
        <div class="col-6 col-md-2"><q-input v-model="f.desde" dense outlined type="date" label="Desde" stack-label /></div>
        <div class="col-6 col-md-2"><q-input v-model="f.hasta" dense outlined type="date" label="Hasta" stack-label /></div>
        <div class="col-12 col-md-1 text-right"><q-btn flat round icon="refresh" @click="cargar"><q-tooltip>Actualizar</q-tooltip></q-btn></div>
      </div>
    </div>

    <div class="panel q-pa-sm">
      <q-table flat :rows="rows" :columns="columnas" row-key="id" :loading="cargando" :rows-per-page-options="[10, 15, 30, 0]"
               :pagination="{ rowsPerPage: 15 }" no-data-label="No hay préstamos con esos filtros" @row-click="(_e, r) => abrir(r.id)">
        <template #body-cell-estado="s">
          <q-td :props="s"><q-badge :color="estadoInfo(s.row).color" :label="estadoInfo(s.row).label" /></q-td>
        </template>
        <template #body-cell-herr="s">
          <q-td :props="s"><span class="text-weight-bold">{{ s.row.total_items }}</span><span v-if="s.row.pendientes" class="text-negative"> · faltan {{ s.row.pendientes }}</span></q-td>
        </template>
        <template #body-cell-limite="s">
          <q-td :props="s"><span :class="s.row.vencido ? 'text-negative text-weight-bold' : ''">{{ fmt(s.row.fecha_limite) }}</span></q-td>
        </template>
        <template #body-cell-acciones="s">
          <q-td :props="s" auto-width @click.stop>
            <q-btn flat round dense color="primary" :icon="s.row.estado === 'activo' ? 'assignment_return' : 'visibility'" @click="abrir(s.row.id)">
              <q-tooltip>{{ s.row.estado === 'activo' ? 'Registrar devolución' : 'Ver detalle' }}</q-tooltip>
            </q-btn>
            <q-btn flat round dense icon="print" @click="imprimir(`/prestamos/${s.row.id}/comprobante`)"><q-tooltip>Imprimir comprobante</q-tooltip></q-btn>
          </q-td>
        </template>
      </q-table>
    </div>

    <PrestamoDialog v-model="dlg" :prestamo-id="sel" @actualizado="cargar" />
  </q-page>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import PrestamoDialog from '../components/PrestamoDialog.vue';
import { api, imprimir } from '../api';
import { useAlertas } from '../stores/alertas';
import { fmt, estadoInfo, codigoPrestamo, col } from '../utils';

const route = useRoute();
const alertas = useAlertas();
const rows = ref([]);
const cursos = ref([{ label: 'Todos los cursos', value: null }]);
const cargando = ref(false);
const dlg = ref(false);
const sel = ref(null);
const f = reactive({ q: '', estado: route.query.estado || 'todos', curso_id: null, desde: '', hasta: '' });
const estados = [
  { label: 'Todos', value: 'todos' }, { label: 'Activos', value: 'activo' },
  { label: 'Vencidos (sin devolver)', value: 'vencido' }, { label: 'Devueltos', value: 'devuelto' },
];

const columnas = [
  col('id', 'Código', { format: (v) => codigoPrestamo(v) }),
  col('fecha_prestamo', 'Prestado', { format: (v) => fmt(v) }),
  col('estudiante', 'Estudiante'), col('curso', 'Curso'), col('responsable', 'Responsable'),
  col('herr', 'Herramientas', { sortable: false }),
  col('limite', 'Devolver antes de', { field: 'fecha_limite' }),
  col('estado', 'Estado', { field: 'estado' }),
  { name: 'acciones', label: '', field: 'id', align: 'right' },
];

async function cargar() {
  cargando.value = true;
  try {
    const params = Object.fromEntries(Object.entries(f).filter(([k, v]) => v && !(k === 'estado' && v === 'todos')));
    rows.value = (await api.get('/prestamos', { params })).data;
    alertas.cargar();
  } finally { cargando.value = false; }
}
const abrir = (id) => { sel.value = id; dlg.value = true; };

watch(f, cargar);
watch(() => route.query.estado, (v) => { f.estado = v || 'todos'; });
onMounted(async () => {
  const { data } = await api.get('/cursos');
  cursos.value.push(...data.map((c) => ({ label: c.nombre, value: c.id })));
  cargar();
});
</script>
