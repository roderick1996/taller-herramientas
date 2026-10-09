<template>
  <div class="panel q-pa-sm">
    <q-table flat :rows="rows" :columns="cols" row-key="id" :loading="cargando" :filter="filtro"
             :rows-per-page-options="[10, 20, 50, 0]" :pagination="{ rowsPerPage: 15 }" no-data-label="Todavía no hay registros">
      <template #top>
        <div class="seccion q-mb-none">{{ titulo }}</div>
        <q-space />
        <slot name="acciones" />
        <q-input v-model="filtro" dense outlined debounce="200" placeholder="Buscar" class="q-mr-sm" style="min-width: 190px">
          <template #prepend><q-icon name="search" /></template>
        </q-input>
        <q-btn unelevated no-caps class="btn-amarillo" icon="add" label="Agregar" @click="abrir()" />
      </template>

      <template #body-cell-activo="s">
        <q-td :props="s"><q-badge :color="s.value ? 'positive' : 'grey'" :label="s.value ? 'Activo' : 'Inactivo'" /></q-td>
      </template>
      <template #body-cell-estado="s">
        <q-td :props="s"><q-badge :color="{ bueno: 'positive', regular: 'warning', malo: 'negative' }[s.value] || 'grey'" :label="s.value" /></q-td>
      </template>
      <template #body-cell-acciones="s">
        <q-td :props="s" auto-width>
          <q-btn flat round dense color="primary" icon="edit" @click="abrir(s.row)"><q-tooltip>Editar</q-tooltip></q-btn>
          <q-btn flat round dense color="negative" icon="delete" @click="borrar(s.row)"><q-tooltip>Eliminar</q-tooltip></q-btn>
        </q-td>
      </template>
    </q-table>

    <q-dialog v-model="dlg" persistent>
      <q-card style="width: 520px; max-width: 96vw">
        <q-form @submit="guardar">
          <q-card-section class="row items-center q-pb-none">
            <div class="titulo text-h5">{{ editId ? 'Editar' : 'Agregar' }} · {{ titulo.toLowerCase() }}</div>
            <q-space /><q-btn flat round dense icon="close" v-close-popup />
          </q-card-section>
          <q-card-section class="q-gutter-y-sm">
            <template v-for="c in campos" :key="c.name">
              <q-select v-if="c.type === 'select'" v-model="form[c.name]" :options="c.options" emit-value map-options outlined
                        :label="c.label" :rules="reglas(c)" />
              <q-toggle v-else-if="c.type === 'toggle'" v-model="form[c.name]" :label="c.label" />
              <q-input v-else v-model="form[c.name]" :type="c.type || 'text'" outlined :label="c.label" :rules="reglas(c)"
                       :hint="c.hint" :autocomplete="c.type === 'password' ? 'new-password' : 'off'" />
            </template>
          </q-card-section>
          <q-card-actions align="right" class="q-pa-md">
            <q-btn flat no-caps label="Cancelar" v-close-popup />
            <q-btn type="submit" unelevated no-caps class="btn-amarillo" label="Guardar" :loading="guardando" />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useQuasar } from 'quasar';
import { api } from '../api';

const props = defineProps({ titulo: String, endpoint: String, columnas: Array, campos: Array });
const $q = useQuasar();
const rows = ref([]);
const cargando = ref(false);
const filtro = ref('');
const dlg = ref(false);
const editId = ref(null);
const form = ref({});
const guardando = ref(false);

const cols = computed(() => [...props.columnas, { name: 'acciones', label: '', field: 'id', align: 'right' }]);
const reglas = (c) => ((c.required || (c.requiredNuevo && !editId.value)) ? [(v) => (v !== '' && v != null) || 'Este dato es obligatorio'] : []);

async function cargar() {
  cargando.value = true;
  try { rows.value = (await api.get(props.endpoint)).data; } finally { cargando.value = false; }
}
function abrir(row) {
  editId.value = row?.id ?? null;
  form.value = Object.fromEntries(props.campos.map((c) => [c.name, row ? (c.type === 'password' ? '' : row[c.name]) : (c.default ?? (c.type === 'toggle' ? true : ''))]));
  dlg.value = true;
}
async function guardar() {
  guardando.value = true;
  try {
    const cuerpo = { ...form.value };
    if (editId.value && cuerpo.password === '') delete cuerpo.password;
    if (editId.value) await api.put(`${props.endpoint}/${editId.value}`, cuerpo);
    else await api.post(props.endpoint, cuerpo);
    $q.notify({ type: 'positive', icon: 'check_circle', message: 'Guardado' });
    dlg.value = false;
    await cargar();
  } catch { /* aviso mostrado por la API */ } finally { guardando.value = false; }
}
function borrar(row) {
  $q.dialog({ title: 'Eliminar', message: `¿Eliminar "${row.nombre || row.codigo || row.usuario}"? Si ya tiene historial se marcará como inactivo.`,
    cancel: { flat: true, label: 'Cancelar', noCaps: true }, ok: { color: 'negative', label: 'Eliminar', noCaps: true, unelevated: true }, persistent: true })
    .onOk(async () => {
      const { data } = await api.delete(`${props.endpoint}/${row.id}`);
      $q.notify({ type: 'positive', message: data.desactivado ? 'Tiene historial: quedó como inactivo' : 'Eliminado' });
      cargar();
    });
}
onMounted(cargar);
defineExpose({ cargar });
</script>
