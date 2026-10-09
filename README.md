# Taller ESFM · Control de herramientas

Sistema web para registrar el préstamo de herramientas del taller de Mecánica Automotriz:
quién presta (compañero responsable), quién recibe (estudiante), qué herramientas se llevó
(10 o más por préstamo), a qué hora debe devolverlas y qué falta por devolver.

**Tecnologías:** Vue 3 · Quasar · Pinia · Vue Router · Chart.js · Node.js + Express · PostgreSQL · PDFKit · ExcelJS · JWT

## Qué incluye

- **Login** con roles (administrador y responsable) y sesión de 12 horas.
- **Panel** con indicadores, gráficos (últimos 14 días, por curso, herramientas más usadas) y lista de quién debe herramientas.
- **Alertas**: si pasa la hora límite y no se devolvió, suena un aviso, aparece una notificación y la campana del encabezado se marca con la cantidad. Se revisa cada 45 segundos.
- **Nuevo préstamo** en 3 pasos: responsable (se escribe su nombre) + estudiante, herramientas (sin límite de cantidad, con control de stock) y confirmación con comprobante imprimible.
- **Devoluciones** completas o parciales, con opción de marcar herramientas perdidas (salen del inventario).
- **Herramientas, categorías, estudiantes (con importación desde Excel), responsables y usuarios**.
- **Reportes** en pantalla, PDF y Excel, con impresión directa: historial de préstamos, herramientas utilizadas, herramientas que faltan e inventario. Se filtran por fechas y curso.
- Modo claro y oscuro.

## Instalación (Ubuntu)

Necesitas Node.js 18 o superior y PostgreSQL 14 o superior.

### 1. Base de datos

Con Docker:

```bash
docker compose up -d
```

O con PostgreSQL instalado en el sistema:

```bash
sudo apt install postgresql
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres'" -c "CREATE DATABASE taller"
```

### 2. Dependencias y datos iniciales

```bash
cp server/.env.example server/.env      # revisa y cambia JWT_SECRET y ADMIN_PASSWORD
npm run install:all
npm run db:setup                         # tablas + administrador + herramientas básicas
npm run db:demo                          # (opcional) 105 estudiantes y préstamos de ejemplo
```

### 3. Ejecutar

```bash
npm run dev
```

Abre http://localhost:9000 e ingresa con **admin / admin123** (o lo que pusiste en `.env`).
Cambia esa contraseña en la sección *Usuarios* antes de usar el sistema de verdad.

## Uso diario

1. El compañero responsable entra al sistema y pulsa **Nuevo préstamo**.
2. Escribe su nombre (si es nuevo, se guarda solo), elige el curso y el estudiante, y define la hora de devolución.
3. Marca las herramientas con el botón **+** y confirma. Puede imprimir el comprobante con firmas.
4. Cuando regresan las herramientas: **Préstamos → Registrar devolución** (todo junto o por partes).
5. Si algo no vuelve a tiempo, el panel y la campana lo muestran en rojo.

Para cargar a los estudiantes reales: **Estudiantes → Importar lista**, y pega tres columnas de Excel (CI, nombres, apellidos).

## Producción (un solo servidor)

```bash
npm run build     # compila la interfaz en client/dist
npm start         # la API sirve la interfaz en http://localhost:3000
```

## Estructura

```
database/schema.sql     tablas de PostgreSQL
server/src/             API (routes.js), reportes PDF/Excel (reports.js), datos iniciales (seed.js)
client/src/pages/       pantallas (panel, nuevo préstamo, préstamos, reportes, catálogos)
client/src/components/  tabla CRUD reutilizable, diálogo de devolución, indicadores
client/src/stores/      sesión y alertas (Pinia)
```

## Datos y seguridad

- Cada préstamo guarda estudiante, responsable, usuario que lo registró, fechas y herramientas con cantidades; nada se borra al devolver.
- Las contraseñas se guardan cifradas (bcrypt). Las rutas de la API exigen sesión y los usuarios solo las puede administrar el rol administrador.
- Las fechas usan la hora de Bolivia (America/La_Paz).
