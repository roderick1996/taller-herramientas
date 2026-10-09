<template>
  <q-page class="page">
    <q-tabs v-model="tab" dense align="left" active-color="primary" indicator-color="accent" no-caps class="q-mb-md">
      <q-tab name="herr" icon="handyman" label="Herramientas" />
      <q-tab name="cat" icon="category" label="Categorías" />
    </q-tabs>
    <CrudPage v-if="tab === 'herr'" titulo="Herramientas" endpoint="/herramientas" :columnas="columnas" :campos="campos" />
    <CrudPage v-else titulo="Categorías" endpoint="/categorias" :columnas="colCat" :campos="campCat" />
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import CrudPage from '../components/CrudPage.vue';
import { api } from '../api';
import { col } from '../utils';

const tab = ref('herr');
const categorias = ref([]);
const cargarCat = async () => { categorias.value = (await api.get('/categorias')).data; };
onMounted(cargarCat);
watch(tab, cargarCat);

const columnas = [
  col('codigo', 'Código'), col('nombre', 'Herramienta'), col('categoria_nombre', 'Categoría'),
  col('cantidad_total', 'Total', { align: 'right' }), col('cantidad_disponible', 'Disponibles', { align: 'right' }),
  col('prestadas', 'Prestadas', { align: 'right' }), col('estado', 'Estado'), col('ubicacion', 'Ubicación'), col('activo', 'Activa'),
];
const campos = computed(() => [
  { name: 'codigo', label: 'Código (ej. HM-013)', required: true },
  { name: 'nombre', label: 'Nombre de la herramienta', required: true },
  { name: 'categoria_id', label: 'Categoría', type: 'select', options: categorias.value.filter((c) => c.activo).map((c) => ({ label: c.nombre, value: c.id })) },
  { name: 'cantidad_total', label: 'Cantidad total en el taller', type: 'number', required: true, default: 1 },
  { name: 'estado', label: 'Estado', type: 'select', default: 'bueno', required: true,
    options: [{ label: 'Bueno', value: 'bueno' }, { label: 'Regular', value: 'regular' }, { label: 'Malo', value: 'malo' }] },
  { name: 'ubicacion', label: 'Ubicación (estante o cajón)' },
  { name: 'activo', label: 'Disponible para préstamo', type: 'toggle' },
]);
const colCat = [col('nombre', 'Categoría'), col('herramientas', 'Herramientas', { align: 'right' }), col('activo', 'Activa')];
const campCat = [{ name: 'nombre', label: 'Nombre de la categoría', required: true }, { name: 'activo', label: 'Activa', type: 'toggle' }];
</script>
