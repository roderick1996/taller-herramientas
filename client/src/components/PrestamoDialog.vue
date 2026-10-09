<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)" :maximized="$q.screen.lt.sm">
    <q-card style="width: 880px; max-width: 96vw">
      <q-card-section class="row items-center q-pb-none">
        <div class="titulo text-h5">Préstamo {{ p ? codigoPrestamo(p.id) : '' }}</div>
        <q-chip v-if="p" dense :color="info.color" text-color="white" :icon="info.icon" :label="info.label" class="q-ml-md" />
        <q-space />
        <q-btn flat round dense icon="close" v-close-popup />
      </q-card-section>

      <q-card-section v-if="p">
        <div class="row q-col-gutter-sm q-mb-md">
          <div class="col-12 col-sm-4"><div class="text-caption text-grey">Estudiante</div><div class="text-weight-bold">{{ p.estudiante }}</div><div class="text-caption">CI {{ p.ci }} · {{ p.curso }}</div></div>
          <div class="col-6 col-sm-3"><div class="text-caption text-grey">Responsable que presta</div><div class="text-weight-bold">{{ p.responsable }}</div></div>
          <div class="col-6 col-sm-2"><div class="text-caption text-grey">Prestado</div><div>{{ fmt(p.fecha_prestamo) }}</div></div>
          <div class="col-12 col-sm-3"><div class="text-caption text-grey">Devolver antes de</div>
            <div :class="p.vencido ? 'text-negative text-weight-bold' : ''">{{ fmt(p.fecha_limite) }}</div></div>
        </div>

        <q-markup-table flat bordered dense separator="horizontal" class="panel">
          <thead>
            <tr>
              <th class="text-left">Herramienta</th><th>Prestadas</th><th>Devueltas</th><th>Perdidas</th><th>Faltan</th>
              <template v-if="abierto"><th>Devuelve ahora</th><th>Se perdió</th></template>
            </tr>
          </thead>
          <tbody>
            <tr v-for="i in p.items" :key="i.id">
              <td class="text-left"><div class="text-weight-medium">{{ i.nombre }}</div><div class="text-caption text-grey">{{ i.codigo }}</div></td>
              <td class="text-center">{{ i.cantidad }}</td>
              <td class="text-center">{{ i.cantidad_devuelta }}</td>
              <td class="text-center">{{ i.cantidad_perdida }}</td>
              <td class="text-center"><q-badge :color="i.pendiente ? 'warning' : 'positive'" :label="i.pendiente" /></td>
              <template v-if="abierto">
                <td style="width: 110px"><q-input v-if="i.pendiente" v-model.number="edit[i.id].devuelve" type="number" dense outlined :min="0" :max="i.pendiente" /></td>
                <td style="width: 110px"><q-input v-if="i.pendiente" v-model.number="edit[i.id].perdidas" type="number" dense outlined :min="0" :max="i.pendiente" /></td>
              </template>
            </tr>
          </tbody>
        </q-markup-table>

        <q-input v-if="abierto" v-model="nota" outlined dense class="q-mt-md" label="Nota de devolución (opcional)" hint="Por ejemplo: llave doblada, falta una pieza" />
        <div v-if="p.observaciones" class="q-mt-md text-caption text-grey" style="white-space: pre-line">Observaciones: {{ p.observaciones }}</div>
      </q-card-section>

      <q-card-actions align="between" class="q-pa-md">
        <div>
          <q-btn flat no-caps icon="picture_as_pdf" label="Comprobante" @click="archivo(`/prestamos/${prestamoId}/comprobante`)" />
          <q-btn flat no-caps icon="print" label="Imprimir" @click="imprimir(`/prestamos/${prestamoId}/comprobante`)" />
        </div>
        <div v-if="abierto">
          <q-btn outline no-caps color="primary" label="Guardar devolución parcial" class="q-mr-sm" :loading="guardando" @click="enviar(false)" />
          <q-btn unelevated no-caps color="positive" icon="done_all" label="Devolver todo" :loading="guardando" @click="enviar(true)" />
        </div>
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useQuasar } from 'quasar';
import { api, archivo, imprimir } from '../api';
import { fmt, estadoInfo, codigoPrestamo } from '../utils';

const props = defineProps({ modelValue: Boolean, prestamoId: Number });
const emit = defineEmits(['update:modelValue', 'actualizado']);
const $q = useQuasar();

const p = ref(null);
const edit = ref({});
const nota = ref('');
const guardando = ref(false);
const info = computed(() => estadoInfo(p.value || {}));
const abierto = computed(() => p.value && p.value.estado === 'activo');

async function cargar() {
  p.value = null;
  const { data } = await api.get(`/prestamos/${props.prestamoId}`);
  p.value = data;
  edit.value = Object.fromEntries(data.items.map((i) => [i.id, { devuelve: 0, perdidas: 0 }]));
  nota.value = '';
}
watch(() => [props.modelValue, props.prestamoId], ([abierta, id]) => { if (abierta && id) cargar(); }, { immediate: true });

async function enviar(todo) {
  guardando.value = true;
  try {
    const cuerpo = todo
      ? { todo: true, nota: nota.value }
      : { nota: nota.value, items: Object.entries(edit.value).map(([id, v]) => ({ item_id: Number(id), devuelve: v.devuelve || 0, perdidas: v.perdidas || 0 })) };
    const { data } = await api.post(`/prestamos/${props.prestamoId}/devolver`, cuerpo);
    $q.notify({ type: 'positive', icon: 'check_circle', message: data.completo ? 'Préstamo devuelto completo' : `Devolución guardada. Aún faltan ${data.pendientes} herramienta(s)` });
    emit('actualizado');
    if (data.completo) emit('update:modelValue', false); else await cargar();
  } catch { /* aviso mostrado por la API */ } finally {
    guardando.value = false;
  }
}
</script>
