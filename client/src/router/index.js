import { createRouter, createWebHashHistory } from 'vue-router';
import { useAuth } from '../stores/auth';

const routes = [
  { path: '/login', component: () => import('../pages/LoginPage.vue'), meta: { publica: true } },
  {
    path: '/',
    component: () => import('../layouts/MainLayout.vue'),
    children: [
      { path: '', component: () => import('../pages/DashboardPage.vue'), meta: { titulo: 'Panel del taller' } },
      { path: 'prestamo/nuevo', component: () => import('../pages/NuevoPrestamoPage.vue'), meta: { titulo: 'Nuevo préstamo' } },
      { path: 'prestamos', component: () => import('../pages/PrestamosPage.vue'), meta: { titulo: 'Préstamos y devoluciones' } },
      { path: 'herramientas', component: () => import('../pages/HerramientasPage.vue'), meta: { titulo: 'Herramientas' } },
      { path: 'estudiantes', component: () => import('../pages/EstudiantesPage.vue'), meta: { titulo: 'Estudiantes' } },
      { path: 'responsables', component: () => import('../pages/ResponsablesPage.vue'), meta: { titulo: 'Responsables' } },
      { path: 'reportes', component: () => import('../pages/ReportesPage.vue'), meta: { titulo: 'Reportes' } },
      { path: 'usuarios', component: () => import('../pages/UsuariosPage.vue'), meta: { titulo: 'Usuarios del sistema', admin: true } },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

const router = createRouter({ history: createWebHashHistory(), routes });

router.beforeEach((to) => {
  const a = useAuth();
  if (!to.meta.publica && !a.logged) return '/login';
  if (to.path === '/login' && a.logged) return '/';
  if (to.meta.admin && !a.isAdmin) return '/';
});

export default router;
