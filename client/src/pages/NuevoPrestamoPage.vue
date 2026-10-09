<template>
  <q-page class="page">
    <q-stepper v-model="paso" flat animated header-nav class="panel" :vertical="$q.screen.lt.md" active-color="primary" done-color="positive" active-icon="edit">
      <!-- 1. Quién presta y quién recibe -->
      <q-step :name="1" title="Quién presta y quién recibe" icon="badge" :done="paso > 1" :header-nav="paso > 1">
        <div class="row q-col-gutter-lg">
          <div class="col-12 col-md-6 q-gutter-y-md">
            <q-select outlined use-input hide-selected fill-input input-debounce="0" :model-value="responsable" :options="respOpts"
                      label="Responsable que presta (compañero)" hint="Escribe tu nombre completo. Si es la primera vez, se guarda solo."
                      @input-value="(v) => (responsable = v)" @filter="filtrarResp">
              <template #prepend><q-icon name="badge" /></template>
              <template #no-option><q-item><q-item-section class="text-grey">Nombre nuevo: se agregará al continuar</q-item-section></q-item></template>
            </q-select>

            <div>
              <div class="text-caption text-grey q-mb-xs">Curso del estudiante</div>
              <q-btn-toggle v-model="cursoSel" no-caps unelevated spread toggle-color="primary" color="grey-4" text-color="dark" :options="opcionesCurso" />
            </div>
            <q-select v-model="estudianteId" outlined use-input input-debounce="0" emit-value map-options :options="estOpts" @filter="filtrarEst"
                      label="Estudiante que recibe" hint="Busca por apellido, nombre o CI">
              <template #prepend><q-icon name="person_search" /></template>
              <template #option="{ itemProps, opt }">
                <q-item v-bind="itemProps">
                  <q-item-section><q-item-label>{{ opt.label }}</q-item-label><q-item-label caption>CI {{ opt.ci }} · {{ opt.curso }}</q-item-label></q-item-section>
                </q-item>
              </template>
              <template #no-option><q-item><q-item-section class="text-grey">No hay estudiantes con ese dato</q-item-section></q-item></template>
            </q-select>
            <q-banner v-if="debe" rounded class="bg-warning text-dark" dense>
              <template #avatar><q-icon name="warning" /></template>
              Este estudiante todavía tiene {{ debe }} herramienta(s) sin devolver.
            </q-banner>
          </div>

          <div class="col-12 col-md-6 q-gutter-y-md">
            <q-input v-model="limite" outlined type="datetime-local" stack-label label="Debe devolver antes de" hint="Pasada esta hora, el sistema avisa que no se devolvió">
              <template #prepend><q-icon name="alarm" /></template>
            </q-input>
            <div class="q-gutter-xs">
              <q-chip clickable v-for="a in plazos" :key="a.l" :label="a.l" icon="schedule" @click="plazo(a.h)" />
            </div>
          </div>
        </div>
        <q-stepper-navigation>
          <q-btn unelevated no-caps class="btn-amarillo" label="Elegir herramientas" icon-right="arrow_forward" :disable="!paso1ok" @click="paso = 2" />
        </q-stepper-navigation>
      </q-step>

      <!-- 2. Herramientas -->
      <q-step :name="2" title="Herramientas" icon="handyman" :done="paso > 2" :header-nav="paso > 2">
        <div class="row q-col-gutter-md">
          <div class="col-12 col-lg-8">
            <div class="row q-col-gutter-sm q-mb-sm">
              <div class="col-12 col-sm-6"><q-input v-model="busca" dense outlined clearable placeholder="Buscar herramienta o código"><template #prepend><q-icon name="search" /></template></q-input></div>
              <div class="col-12 col-sm-6"><q-select v-model="catSel" dense outlined emit-value map-options :options="opcionesCat" label="Categoría" /></div>
            </div>
            <div class="rejilla-herr">
              <div v-for="h in visibles" :key="h.id" class="herr panel" :class="{ elegida: carrito[h.id], agotada: !h.cantidad_disponible }">
                <div class="nom">{{ h.nombre }}</div>
                <div class="row items-center no-wrap">
                  <q-badge outline color="grey-7" :label="h.codigo" />
                  <q-space />
                  <q-badge :color="h.cantidad_disponible ? (h.cantidad_disponible <= 1 ? 'warning' : 'positive') : 'negative'"
                           :label="h.cantidad_disponible ? `${h.cantidad_disponible} disp.` : 'Agotada'" />
                </div>
                <div class="row items-center justify-center q-gutter-sm">
                  <q-btn round dense flat icon="remove" :disable="!carrito[h.id]" @click="cambiar(h, -1)" />
                  <div class="cant">{{ carrito[h.id] || 0 }}</div>
                  <q-btn round dense unelevated class="btn-amarillo" icon="add" :disable="(carrito[h.id] || 0) >= h.cantidad_disponible" @click="cambiar(h, 1)" />
                </div>
              </div>
            </div>
            <div v-if="!visibles.length" class="text-grey q-pa-lg text-center">No hay herramientas con ese filtro.</div>
          </div>

          <div class="col-12 col-lg-4">
            <div class="panel q-pa-md" style="position: sticky; top: 76px">
              <div class="seccion">Herramientas elegidas</div>
              <div v-if="!items.length" class="text-grey">Todavía no elegiste ninguna. Usa el botón + de cada herramienta; puedes llevar 10 o más.</div>
              <q-list v-else dense separator style="max-height: 340px; overflow: auto">
                <q-item v-for="i in items" :key="i.id">
                  <q-item-section>{{ i.nombre }}</q-item-section>
                  <q-item-section side class="text-weight-bold">×{{ i.cant }}</q-item-section>
                  <q-item-section side><q-btn flat round dense size="sm" icon="close" @click="delete carrito[i.id]" /></q-item-section>
                </q-item>
              </q-list>
              <q-separator class="q-my-sm" />
              <div class="row"><span>Tipos</span><q-space /><b>{{ items.length }}</b></div>
              <div class="row"><span>Unidades en total</span><q-space /><b>{{ unidades }}</b></div>
            </div>
          </div>
        </div>
        <q-stepper-navigation>
          <q-btn flat no-caps label="Atrás" @click="paso = 1" />
          <q-btn unelevated no-caps class="btn-amarillo q-ml-sm" label="Revisar y confirmar" icon-right="arrow_forward" :disable="!items.length" @click="paso = 3" />
        </q-stepper-navigation>
      </q-step>

      <!-- 3. Confirmar -->
      <q-step :name="3" title="Confirmar" icon="fact_check">
        <div class="row q-col-gutter-lg">
          <div class="col-12 col-md-5 q-gutter-y-sm">
            <div><div class="text-caption text-grey">Estudiante</div><div class="text-h6 titulo">{{ estudianteSel?.label }}</div><div class="text-caption">CI {{ estudianteSel?.ci }} · {{ estudianteSel?.curso }}</div></div>
            <div><div class="text-caption text-grey">Responsable que presta</div><div class="text-weight-bold">{{ responsable }}</div></div>
            <div><div class="text-caption text-grey">Debe devolver antes de</div><div class="text-weight-bold">{{ fmt(limite) }}</div></div>
            <q-input v-model="obs" outlined type="textarea" rows="3" label="Observaciones (opcional)" />
          </div>
          <div class="col-12 col-md-7">
            <q-markup-table flat bordered dense class="panel" separator="horizontal">
              <thead><tr><th class="text-left">Herramienta</th><th class="text-right">Cantidad</th></tr></thead>
              <tbody><tr v-for="i in items" :key="i.id"><td class="text-left">{{ i.nombre }} <span class="text-caption text-grey">{{ i.codigo }}</span></td><td class="text-right text-weight-bold">{{ i.cant }}</td></tr></tbody>
            </q-markup-table>
            <div class="text-right q-mt-sm text-weight-bold">{{ unidades }} unidades en {{ items.length }} herramientas</div>
          </div>
        </div>
        <q-stepper-navigation>
          <q-btn flat no-caps label="Atrás" @click="paso = 2" />
          <q-btn unelevated no-caps color="positive" class="q-ml-sm" icon="check" label="Registrar préstamo" :loading="guardando" @click="registrar" />
        </q-stepper-navigation>
      </q-step>
    </q-stepper>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useQuasar } from 'quasar';
import { api, imprimir } from '../api';
import { toLocalInput, fmt, codigoPrestamo } from '../utils';

const $q = useQuasar();
const paso = ref(1);
const guardando = ref(false);

const cursos = ref([]), estudiantes = ref([]), responsables = ref([]), herramientas = ref([]), categorias = ref([]), activos = ref([]);
const responsable = ref('');
const respOpts = ref([]);
const cursoSel = ref(0);
const estudianteId = ref(null);
const estOpts = ref([]);
const limite = ref('');
const obs = ref('');
const busca = ref('');
const catSel = ref(0);
const carrito = ref({});

const plazos = [{ l: '1 hora', h: 1 }, { l: '2 horas', h: 2 }, { l: '4 horas', h: 4 }, { l: 'Hasta el fin del día', h: 'dia' }];
function plazo(h) {
  const d = new Date();
  if (h === 'dia') d.setHours(23, 59, 0, 0); else d.setHours(d.getHours() + h);
  limite.value = toLocalInput(d);
}

const opcionesCurso = computed(() => [{ label: 'Todos', value: 0 }, ...cursos.value.map((c) => ({ label: c.nombre.split(' ')[0] + ' año', value: c.id }))]);
const todosEst = computed(() => estudiantes.value.filter((e) => e.activo && (!cursoSel.value || e.curso_id === cursoSel.value))
  .map((e) => ({ label: `${e.apellidos} ${e.nombres}`, value: e.id, ci: e.ci, curso: e.curso_nombre })));
const estudianteSel = computed(() => estudiantes.value.map((e) => ({ label: `${e.apellidos} ${e.nombres}`, value: e.id, ci: e.ci, curso: e.curso_nombre })).find((e) => e.value === estudianteId.value));

function filtrarResp(val, update) {
  update(() => { const n = val.toLowerCase(); respOpts.value = responsables.value.filter((r) => r.toLowerCase().includes(n)); });
}
function filtrarEst(val, update) {
  update(() => { const n = val.toLowerCase(); estOpts.value = todosEst.value.filter((e) => `${e.label} ${e.ci}`.toLowerCase().includes(n)); });
}

const debe = computed(() => activos.value.filter((a) => a.estudiante_id === estudianteId.value).reduce((s, a) => s + a.pendientes, 0));
const paso1ok = computed(() => responsable.value.trim().length >= 3 && estudianteId.value && limite.value);

const opcionesCat = computed(() => [{ label: 'Todas', value: 0 }, ...categorias.value.map((c) => ({ label: c.nombre, value: c.id }))]);
const visibles = computed(() => herramientas.value.filter((h) => h.activo && (!catSel.value || h.categoria_id === catSel.value)
  && (!busca.value || `${h.nombre} ${h.codigo}`.toLowerCase().includes(busca.value.toLowerCase()))));
const items = computed(() => Object.entries(carrito.value).map(([id, cant]) => ({ ...herramientas.value.find((h) => h.id === Number(id)), cant })));
const unidades = computed(() => items.value.reduce((s, i) => s + i.cant, 0));

function cambiar(h, d) {
  const n = Math.max(0, Math.min(h.cantidad_disponible, (carrito.value[h.id] || 0) + d));
  if (n) carrito.value[h.id] = n; else delete carrito.value[h.id];
}

async function cargarDatos() {
  const [h, a] = await Promise.all([api.get('/herramientas'), api.get('/prestamos', { params: { estado: 'activo' } })]);
  herramientas.value = h.data;
  activos.value = a.data;
}
onMounted(async () => {
  plazo(2);
  const [c, e, r, cat] = await Promise.all([api.get('/cursos'), api.get('/estudiantes'), api.get('/responsables'), api.get('/categorias')]);
  cursos.value = c.data; estudiantes.value = e.data; categorias.value = cat.data.filter((x) => x.activo);
  responsables.value = r.data.filter((x) => x.activo).map((x) => x.nombre);
  await cargarDatos();
});

async function registrar() {
  guardando.value = true;
  try {
    const { data } = await api.post('/prestamos', {
      estudiante_id: estudianteId.value, responsable: responsable.value.trim(), fecha_limite: new Date(limite.value).toISOString(),
      observaciones: obs.value, items: items.value.map((i) => ({ herramienta_id: i.id, cantidad: i.cant })),
    });
    $q.dialog({
      title: 'Préstamo registrado', message: `Código ${codigoPrestamo(data.id)} · ${unidades.value} herramientas para ${estudianteSel.value.label}. ¿Quieres imprimir el comprobante?`,
      ok: { label: 'Imprimir comprobante', unelevated: true, noCaps: true, color: 'primary' }, cancel: { label: 'Ahora no', flat: true, noCaps: true }, persistent: true,
    }).onOk(() => imprimir(`/prestamos/${data.id}/comprobante`)).onDismiss(reiniciar);
  } catch { /* aviso mostrado por la API */ } finally { guardando.value = false; }
}
async function reiniciar() {
  carrito.value = {}; estudianteId.value = null; obs.value = ''; busca.value = ''; paso.value = 1;
  if (!responsables.value.includes(responsable.value.trim())) responsables.value.push(responsable.value.trim());
  await cargarDatos();
}
</script>
