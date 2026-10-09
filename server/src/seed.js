// Crea las tablas, el usuario administrador y datos base.
//   npm run setup        -> tablas + admin + cursos + herramientas básicas
//   npm run seed:demo    -> además agrega estudiantes y préstamos de ejemplo
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { pool, q } from './db.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const demo = process.argv.includes('--demo');

const CATEGORIAS = { 'Herramientas manuales': 'HM', 'Medición y precisión': 'MP', 'Eléctricas y neumáticas': 'EN',
  'Diagnóstico y electricidad': 'DE', 'Elevación y soporte': 'ES', 'Lubricación y limpieza': 'LL', 'Seguridad': 'SE' };
const HERRAMIENTAS = [
  ['Herramientas manuales', 'Juego de llaves combinadas (8-24 mm)', 8], ['Herramientas manuales', 'Juego de dados con ratchet 1/2"', 6],
  ['Herramientas manuales', 'Juego de dados con ratchet 3/8"', 6], ['Herramientas manuales', 'Juego de destornilladores', 10],
  ['Herramientas manuales', 'Alicate universal', 8], ['Herramientas manuales', 'Alicate de presión', 6],
  ['Herramientas manuales', 'Martillo de bola', 5], ['Herramientas manuales', 'Mazo de goma', 4],
  ['Herramientas manuales', 'Juego de llaves Allen', 6], ['Herramientas manuales', 'Llave para bujías', 6],
  ['Herramientas manuales', 'Extractor de filtro de aceite', 3], ['Herramientas manuales', 'Llave de cruz', 4],
  ['Medición y precisión', 'Torquímetro 1/2"', 4], ['Medición y precisión', 'Calibrador vernier', 5],
  ['Medición y precisión', 'Micrómetro 0-25 mm', 3], ['Medición y precisión', 'Reloj comparador', 3],
  ['Medición y precisión', 'Galgas de láminas', 5], ['Medición y precisión', 'Compresómetro', 2], ['Medición y precisión', 'Manómetro de aceite', 2],
  ['Eléctricas y neumáticas', 'Taladro eléctrico', 3], ['Eléctricas y neumáticas', 'Pistola de impacto neumática', 3],
  ['Eléctricas y neumáticas', 'Esmeril angular', 2], ['Eléctricas y neumáticas', 'Pistola de aire', 4],
  ['Diagnóstico y electricidad', 'Multímetro digital', 6], ['Diagnóstico y electricidad', 'Pinza amperimétrica', 3],
  ['Diagnóstico y electricidad', 'Escáner OBD2', 2], ['Diagnóstico y electricidad', 'Probador de inyectores', 2],
  ['Diagnóstico y electricidad', 'Lámpara estroboscópica', 2], ['Diagnóstico y electricidad', 'Probador de batería', 2],
  ['Elevación y soporte', 'Gato hidráulico de piso', 3], ['Elevación y soporte', 'Caballetes de seguridad (par)', 4],
  ['Elevación y soporte', 'Gata de botella', 3], ['Lubricación y limpieza', 'Bandeja recolectora de aceite', 5],
  ['Lubricación y limpieza', 'Engrasadora manual', 3], ['Lubricación y limpieza', 'Juego de embudos', 4],
  ['Seguridad', 'Gafas de seguridad', 12], ['Seguridad', 'Lámpara de taller portátil', 4],
];

try {
  await q(fs.readFileSync(path.join(dir, '../../database/schema.sql'), 'utf8'));
  console.log('✔ Tablas listas');

  const admin = (process.env.ADMIN_USER || 'admin').toLowerCase();
  await q(`INSERT INTO usuarios(nombre,usuario,password_hash,rol) VALUES('Administrador',$1,$2,'admin') ON CONFLICT (usuario) DO NOTHING`,
    [admin, await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10)]);
  for (const c of ['1er Año de Formación', '2do Año de Formación', '3er Año de Formación'])
    await q('INSERT INTO cursos(nombre) VALUES($1) ON CONFLICT (nombre) DO NOTHING', [c]);
  for (const c of Object.keys(CATEGORIAS)) await q('INSERT INTO categorias(nombre) VALUES($1) ON CONFLICT (nombre) DO NOTHING', [c]);

  const { rows: [{ n }] } = await q('SELECT COUNT(*)::int AS n FROM herramientas');
  if (!n) {
    const cont = {};
    for (const [cat, nombre, cant] of HERRAMIENTAS) {
      const pref = CATEGORIAS[cat];
      cont[pref] = (cont[pref] || 0) + 1;
      await q(`INSERT INTO herramientas(codigo,nombre,categoria_id,cantidad_total,cantidad_disponible,ubicacion)
               VALUES($1,$2,(SELECT id FROM categorias WHERE nombre=$3),$4,$4,$5)`,
        [`${pref}-${String(cont[pref]).padStart(3, '0')}`, nombre, cat, cant, `Estante ${pref}`]);
    }
    console.log(`✔ ${HERRAMIENTAS.length} herramientas de ejemplo`);
  }
  console.log(`✔ Usuario administrador: ${admin}`);

  if (demo) {
    const NOM = ['Juan Carlos', 'Luis Fernando', 'Carlos', 'Marco Antonio', 'Jhon', 'Edwin', 'Rolando', 'Wilder', 'Freddy', 'Limbert',
      'Daniel', 'Cristian', 'Álvaro', 'René', 'Mauricio', 'Pablo', 'Ever', 'Marcelo', 'Gonzalo', 'Franz', 'María', 'Ruth', 'Lidia', 'Sonia', 'Norma'];
    const APE = ['Mamani', 'Quispe', 'Choque', 'Flores', 'Condori', 'Colque', 'Gutiérrez', 'Vargas', 'Copa', 'Cruz', 'Huanca', 'Rojas',
      'Cussi', 'Tarqui', 'Calizaya', 'Ayala', 'Mendoza', 'Torrez', 'Apaza', 'Guzmán'];
    for (let c = 1; c <= 3; c++) {
      const { rows: [curso] } = await q('SELECT id FROM cursos ORDER BY id OFFSET $1 LIMIT 1', [c - 1]);
      for (let j = 0; j < 35; j++) {
        await q('INSERT INTO estudiantes(ci,nombres,apellidos,curso_id) VALUES($1,$2,$3,$4) ON CONFLICT (ci) DO NOTHING',
          [String(9000000 + c * 100 + j), NOM[(j * 7 + c) % NOM.length], `${APE[(j * 3 + c) % APE.length]} ${APE[(j * 5 + c * 2 + 1) % APE.length]}`, curso.id]);
      }
    }
    const { rows: [{ n: prest }] } = await q('SELECT COUNT(*)::int AS n FROM prestamos');
    if (!prest) {
      const nombres = (await q('SELECT nombre FROM herramientas ORDER BY id')).rows.map((x) => x.nombre);
      const RESP = ['Edwin Quispe', 'Marcelo Choque', 'Ruth Mamani'];
      let s = 7;
      const rnd = (k) => { s = (s * 9301 + 49297) % 233280; return Math.floor((s / 233280) * k); };
      const prestar = async (ci, resp, items, haceHoras, plazoHoras, devuelto) => {
        const { rows: [e] } = await q('SELECT id FROM estudiantes WHERE ci=$1', [ci]);
        const { rows: [r] } = await q('INSERT INTO responsables(nombre) VALUES($1) ON CONFLICT (lower(nombre)) DO UPDATE SET activo=true RETURNING id', [resp]);
        const { rows: [p] } = await q(`INSERT INTO prestamos(estudiante_id,responsable_id,fecha_prestamo,fecha_limite,estado,fecha_cierre)
          VALUES($1,$2, now() - make_interval(hours => $3::int), now() - make_interval(hours => $3::int) + make_interval(hours => $4::int),
          '${devuelto ? 'devuelto' : 'activo'}', ${devuelto ? "now() - make_interval(hours => $3::int) + interval '2 hours'" : 'NULL'}) RETURNING id`,
        [e.id, r.id, haceHoras, plazoHoras]);
        for (const [nom, cant] of items) {
          const { rows: [h] } = await q('SELECT id FROM herramientas WHERE nombre=$1', [nom]);
          await q('INSERT INTO prestamo_items(prestamo_id,herramienta_id,cantidad,cantidad_devuelta) VALUES($1,$2,$3,$4)', [p.id, h.id, cant, devuelto ? cant : 0]);
          if (!devuelto) await q('UPDATE herramientas SET cantidad_disponible=cantidad_disponible-$1 WHERE id=$2', [cant, h.id]);
        }
      };
      const ci = () => String(9000000 + (1 + rnd(3)) * 100 + rnd(35));
      for (let d = 1; d <= 10; d++) {
        for (let k = 0, veces = 1 + rnd(3); k < veces; k++) {
          const items = [...new Set(Array.from({ length: 3 + rnd(8) }, () => nombres[rnd(nombres.length)]))].map((x) => [x, 1 + rnd(2)]);
          await prestar(ci(), RESP[rnd(3)], items, 24 * d + rnd(6), 4, true);
        }
      }
      await prestar('9000105', RESP[0], nombres.slice(0, 10).map((x) => [x, 1]), 30, 4, false); // vencido, con 10 herramientas
      await prestar('9000212', RESP[1], [['Multímetro digital', 1], ['Pinza amperimétrica', 1], ['Escáner OBD2', 1]], 28, 3, false); // vencido
      await prestar('9000320', RESP[2], [['Torquímetro 1/2"', 1], ['Calibrador vernier', 2]], 1, 3, false); // en plazo
      await prestar('9000118', RESP[0], [['Gato hidráulico de piso', 1], ['Caballetes de seguridad (par)', 2]], 0, 4, false); // en plazo
      console.log('✔ Estudiantes (35 por curso) y préstamos de ejemplo');
    }
  }
  console.log('Listo.');
} catch (e) {
  console.error('✘ Error:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
