import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import routes from './routes.js';

const app = express();
const dir = path.dirname(fileURLToPath(import.meta.url));

app.use(helmet({ contentSecurityPolicy: false })); // el PDF se abre desde blob: en el navegador
app.use(cors());
app.use(express.json({ limit: '2mb' }));
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

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API del taller lista en http://localhost:${port}`));
