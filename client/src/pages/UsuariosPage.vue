<template>
  <q-page class="page">
    <CrudPage titulo="Usuarios" endpoint="/usuarios" :columnas="columnas" :campos="campos" />
  </q-page>
</template>

<script setup>
import CrudPage from '../components/CrudPage.vue';
import { col } from '../utils';

const columnas = [col('nombre', 'Nombre'), col('usuario', 'Usuario'), col('rol', 'Rol'), col('activo', 'Estado')];
const campos = [
  { name: 'nombre', label: 'Nombre completo', required: true },
  { name: 'usuario', label: 'Usuario para ingresar', required: true },
  { name: 'password', label: 'Contraseña', type: 'password', requiredNuevo: true, hint: 'Mínimo 6 caracteres. Al editar, déjala vacía para no cambiarla' },
  { name: 'rol', label: 'Rol', type: 'select', required: true, default: 'responsable',
    options: [{ label: 'Administrador (todo)', value: 'admin' }, { label: 'Responsable (presta y recibe)', value: 'responsable' }] },
  { name: 'activo', label: 'Puede ingresar', type: 'toggle' },
];
</script>
