import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit'; // 👈 Importación de Rate Limit
import { q } from './db.js';
import routes from './routes.js';

const app = express();
const dir = path.dirname(fileURLToPath(import.meta.url));

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false })); // El PDF se abre desde blob: en el navegador
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// 🛡️ Protección contra fuerza bruta (Limitador de peticiones para Login y Auth)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // Ventana de 15 minutos
  max: 5, // Máximo 5 intentos por IP cada 15 minutos
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos fallidos. Por seguridad, intente de nuevo en 15 minutos.' }
});

// Aplicar el limitador específicamente a las rutas de inicio de sesión / autenticación
app.use('/api/auth/login', loginLimiter);

app.get('/api/salud', (_req, res) => res.json({ ok: true }));
app.use('/api', routes);

// En producción sirve el frontend compilado (client/dist)
const dist = path.resolve(dir, '../../client/dist');
if (fs.existsSync(dist)) app.use(express.static(dist));

const ERRORES_PG = {
  23505: [409, 'Ya existe un registro con esos datos (código, CI o nombre repetido)'],
  23514: [400, 'Algún valor no es válido (por ejemplo, el stock no alcanza)'],
  23503: [409, 'Los datos relacionados no existen o están en uso'],
  23502: [400, 'Falta completar un campo obligatorio'],
  '22P02': [400, 'Un valor tiene formato incorrecto'],
};

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.status) return res.status(err.status).json({ error: err.message });
  const m = ERRORES_PG[err.code];
  if (m) return res.status(m[0]).json({ error: m[1] });
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

async function asegurarAdmin() {
  try {
    const hash = await bcrypt.hash('admin123', 10);
    await q(`
      INSERT INTO usuarios (nombre, usuario, password_hash, rol)
      VALUES ('Administrador', 'admin', $1, 'admin')
      ON CONFLICT (usuario) 
      DO NOTHING;
    `, [hash]);
    console.log('✔ Usuario administrador verificado');
  } catch (e) {
    console.error('Error al asegurar admin:', e.message);
  }
}

const port = process.env.PORT || 3000;
if (!process.env.VERCEL) app.listen(port, async () => {
  await asegurarAdmin();
  console.log(`API del taller lista en http://localhost:${port}`);
});

export default app;