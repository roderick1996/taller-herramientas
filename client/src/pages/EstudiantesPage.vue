<template>
  <q-page class="page">
    <CrudPage ref="crud" titulo="Estudiantes" endpoint="/estudiantes" :columnas="columnas" :campos="campos">
      <template #acciones>
        <q-btn outline no-caps color="primary" icon="upload_file" label="Importar lista" class="q-mr-sm" @click="dlg = true" />
      </template>
    </CrudPage>

    <q-dialog v-model="dlg">
      <q-card style="width: 640px; max-width: 96vw">
        <q-card-section class="row items-center q-pb-none">
          <div class="titulo text-h5">Importar lista de estudiantes</div>
          <q-space /><q-btn flat round dense icon="close" v-close-popup />
        </q-card-section>
        <q-card-section class="q-gutter-y-md">
          <q-select v-model="curso" :options="cursos" emit-value map-options outlined label="Curso donde se agregan" />
          <q-input v-model="texto" type="textarea" outlined rows="9" label="Una línea por estudiante: CI ; Nombres ; Apellidos"
                   hint="Puedes copiar y pegar tres columnas desde Excel (separadas por tabulación, coma o punto y coma)"
                   placeholder="7654321; Juan Carlos; Mamani Quispe" />
          <div class="text-caption text-grey">{{ filas.length }} estudiante(s) detectados</div>
        </q-card-section>
        <q-card-actions align="right" class="q-pa-md">
          <q-btn flat no-caps label="Cancelar" v-close-popup />
          <q-btn unelevated no-caps class="btn-amarillo" label="Importar" :disable="!curso || !filas.length" :loading="cargando" @click="importar" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useQuasar } from 'quasar';
import CrudPage from '../components/CrudPage.vue';
import { api } from '../api';
import { col } from '../utils';

const $q = useQuasar();
const crud = ref(null);
const cursos = ref([]);
const dlg = ref(false);
const curso = ref(null);
const texto = ref('');
const cargando = ref(false);

onMounted(async () => { cursos.value = (await api.get('/cursos')).data.map((c) => ({ label: c.nombre, value: c.id })); });

const filas = computed(() => texto.value.split('\n').map((l) => l.split(/[;\t,]/).map((x) => x.trim()))
  .filter((p) => p.length >= 3 && p[0]).map(([ci, nombres, apellidos]) => ({ ci, nombres, apellidos })));

async function importar() {
  cargando.value = true;
  try {
    const { data } = await api.post('/estudiantes/importar', { curso_id: curso.value, filas: filas.value });
    $q.notify({ type: 'positive', message: `${data.insertados} agregados, ${data.omitidos} omitidos (ya existían o estaban incompletos)` });
    dlg.value = false;
    texto.value = '';
    crud.value.cargar();
  } catch { /* aviso mostrado por la API */ } finally { cargando.value = false; }
}

const columnas = [col('ci', 'CI'), col('apellidos', 'Apellidos'), col('nombres', 'Nombres'), col('curso_nombre', 'Curso'), col('celular', 'Celular'), col('activo', 'Estado')];
const campos = computed(() => [
  { name: 'ci', label: 'Cédula de identidad', required: true },
  { name: 'nombres', label: 'Nombres', required: true },
  { name: 'apellidos', label: 'Apellidos', required: true },
  { name: 'curso_id', label: 'Curso', type: 'select', required: true, options: cursos.value },
  { name: 'celular', label: 'Celular' },
  { name: 'activo', label: 'Estudiante activo', type: 'toggle' },
]);
</script>
