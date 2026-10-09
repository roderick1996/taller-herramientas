<template>
  <div class="stat panel" :class="{ pulso: pulso }" :style="{ '--tono': color }">
    <q-icon :name="icono" size="34px" />
    <div>
      <div class="valor">{{ mostrado }}</div>
      <div class="etq">{{ label }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  label: String,
  valor: { type: Number, default: 0 },
  icono: String,
  color: { type: String, default: '#2d5f8b' },
  pulso: Boolean,
});
const mostrado = ref(0);

function animar(hasta) {
  const ini = mostrado.value, t0 = performance.now();
  const paso = (t) => {
    const k = Math.min(1, (t - t0) / 650);
    mostrado.value = Math.round(ini + (hasta - ini) * (1 - (1 - k) ** 3));
    if (k < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}
watch(() => props.valor, animar, { immediate: true });
</script>
