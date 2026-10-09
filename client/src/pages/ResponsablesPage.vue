<template>
  <q-page class="page">
    <q-banner rounded class="panel q-mb-md" dense>
      <template #avatar><q-icon name="info" color="primary" /></template>
      Los responsables son los compañeros que prestan las herramientas. También se agregan solos cuando escribes un nombre nuevo al registrar un préstamo.
    </q-banner>
    <CrudPage titulo="Responsables" endpoint="/responsables" :columnas="columnas" :campos="campos" />
  </q-page>
</template>

<script setup>
import CrudPage from '../components/CrudPage.vue';
import { col } from '../utils';

const columnas = [col('nombre', 'Nombre completo'), col('activo', 'Estado')];
const campos = [{ name: 'nombre', label: 'Nombre completo', required: true }, { name: 'activo', label: 'Activo', type: 'toggle' }];
</script>
