import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { q, tx } from './db.js';
import { HttpError } from './errors.js';
import { getReport, getComprobante, toPdf, toExcel } from './reports.js';

const SECRET = process.env.JWT_SECRET || 'secreto-solo-para-desarrollo';
const r = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const limpio = (v) => (typeof v === 'string' ? (v.trim() === '' ? null : v.trim()) : v);

/* ---------- Autenticación ---------- */
const limitador = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' },
});

r.post('/auth/login', limitador, wrap(async (req, res) => {
  const usuario = String(req.body.usuario || '').toLowerCase().trim();
  const { rows: [u] } = await q('SELECT * FROM usuarios WHERE usuario=$1 AND activo', [usuario]);
  if (!u || !(await bcrypt.compare(String(req.body.password || ''), u.password_hash))) {
    throw new HttpError(401, 'Usuario o contraseña incorrectos');
  }
  const user = { id: u.id, nombre: u.nombre, usuario: u.usuario, rol: u.rol };
  res.json({ token: jwt.sign(user, SECRET, { expiresIn: '12h' }), user });
}));

function auth(req, res, next) {
  const h = req.headers.authorization || '';
  try {
    req.user = jwt.verify(h.startsWith('Bearer ') ? h.slice(7) : '', SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Sesión no válida o expirada' });
  }
}
const soloAdmin = (req, res, next) =>
  req.user.rol === 'admin' ? next() : res.status(403).json({ error: 'Solo el administrador puede hacer esto' });

r.use(auth);
r.get('/auth/me', (req, res) => res.json(req.user));

/* ---------- Utilidades CRUD ---------- */
async function borrar(tabla, id, res) {
  try {
    await q(`DELETE FROM ${tabla} WHERE id=$1`, [id]);
    res.json({ ok: true });
  } catch (e) {
    if (e.code === '23503') { // tiene historial: se desactiva en lugar de borrar
      await q(`UPDATE ${tabla} SET activo=false WHERE id=$1`, [id]);
      return res.json({ ok: true, desactivado: true });
    }
    throw e;
  }
}

function catalogo(ruta, tabla, campos, requeridos, listaSql) {
  const datos = (req) => {
    const d = {};
    for (const c of campos) if (req.body[c] !== undefined) d[c] = limpio(req.body[c]);
    return d;
  };
  r.get(`/${ruta}`, wrap(async (_req, res) => res.json((await q(listaSql)).rows)));
  r.post(`/${ruta}`, wrap(async (req, res) => {
    const d = datos(req);
    for (const c of requeridos) if (d[c] == null) throw new HttpError(400, `Falta completar: ${c}`);
    const cols = Object.keys(d);
    const { rows: [row] } = await q(
      `INSERT INTO ${tabla} (${cols.join(',')}) VALUES (${cols.map((_, i) => '$' + (i + 1)).join(',')}) RETURNING id`,
      cols.map((c) => d[c]));
    res.status(201).json(row);
  }));
  r.put(`/${ruta}/:id`, wrap(async (req, res) => {
    const d = datos(req);
    for (const c of requeridos) if (c in d && d[c] == null) throw new HttpError(400, `Falta completar: ${c}`);
    const cols = Object.keys(d);
    if (!cols.length) throw new HttpError(400, 'No hay cambios');
    await q(`UPDATE ${tabla} SET ${cols.map((c, i) => `${c}=$${i + 1}`).join(',')} WHERE id=$${cols.length + 1}`,
      [...cols.map((c) => d[c]), req.params.id]);
    res.json({ ok: true });
  }));
  r.delete(`/${ruta}/:id`, wrap((req, res) => borrar(tabla, req.params.id, res)));
}

catalogo('estudiantes', 'estudiantes', ['ci', 'nombres', 'apellidos', 'celular', 'curso_id', 'activo'],
  ['ci', 'nombres', 'apellidos', 'curso_id'],
  `SELECT e.*, c.nombre AS curso_nombre FROM estudiantes e JOIN cursos c ON c.id=e.curso_id
   ORDER BY c.id, e.apellidos, e.nombres`);
catalogo('responsables', 'responsables', ['nombre', 'activo'], ['nombre'],
  'SELECT * FROM responsables ORDER BY nombre');
catalogo('categorias', 'categorias', ['nombre', 'activo'], ['nombre'],
  `SELECT c.*, (SELECT COUNT(*) FROM herramientas h WHERE h.categoria_id=c.id)::int AS herramientas
   FROM categorias c ORDER BY nombre`);

r.get('/cursos', wrap(async (_req, res) => res.json((await q('SELECT * FROM cursos ORDER BY id')).rows)));

/* Importar lista de estudiantes pegada desde Excel (CI; nombres; apellidos) */
r.post('/estudiantes/importar', wrap(async (req, res) => {
  const { curso_id, filas = [] } = req.body;
  if (!curso_id) throw new HttpError(400, 'Elige el curso');
  let insertados = 0, omitidos = 0;
  await tx(async (db) => {
    for (const f of filas) {
      const ci = limpio(f.ci), nombres = limpio(f.nombres), apellidos = limpio(f.apellidos);
      if (!ci || !nombres || !apellidos) { omitidos++; continue; }
      const x = await db.query(
        'INSERT INTO estudiantes(ci,nombres,apellidos,curso_id) VALUES($1,$2,$3,$4) ON CONFLICT (ci) DO NOTHING',
        [ci, nombres, apellidos, curso_id]);
      x.rowCount ? insertados++ : omitidos++;
    }
  });
  res.json({ insertados, omitidos });
}));

/* ---------- Herramientas (con stock) ---------- */
const LISTA_HERR = `SELECT h.*, c.nombre AS categoria_nombre, (h.cantidad_total - h.cantidad_disponible) AS prestadas
  FROM herramientas h LEFT JOIN categorias c ON c.id=h.categoria_id
  ORDER BY c.nombre NULLS LAST, h.nombre`;
r.get('/herramientas', wrap(async (_req, res) => res.json((await q(LISTA_HERR)).rows)));

function datosHerramienta(b) {
  const total = Number.parseInt(b.cantidad_total, 10);
  if (!limpio(b.codigo) || !limpio(b.nombre)) throw new HttpError(400, 'Completa código y nombre');
  if (!Number.isInteger(total) || total < 0) throw new HttpError(400, 'La cantidad total no es válida');
  return [limpio(b.codigo), limpio(b.nombre), limpio(b.categoria_id), total, b.estado || 'bueno',
    limpio(b.ubicacion), b.activo !== false];
}
r.post('/herramientas', wrap(async (req, res) => {
  const d = datosHerramienta(req.body);
  const { rows: [row] } = await q(
    `INSERT INTO herramientas(codigo,nombre,categoria_id,cantidad_total,cantidad_disponible,estado,ubicacion,activo)
     VALUES($1,$2,$3,$4,$4,$5,$6,$7) RETURNING id`, d);
  res.status(201).json(row);
}));
r.put('/herramientas/:id', wrap(async (req, res) => {
  const d = datosHerramienta(req.body);
  // La disponibilidad se recalcula: nuevo total - lo que sigue prestado
  await q(`UPDATE herramientas SET codigo=$1, nombre=$2, categoria_id=$3,
    cantidad_disponible = $4 - (cantidad_total - cantidad_disponible), cantidad_total=$4,
    estado=$5, ubicacion=$6, activo=$7 WHERE id=$8`, [...d, req.params.id]);
  res.json({ ok: true });
}));
r.delete('/herramientas/:id', wrap((req, res) => borrar('herramientas', req.params.id, res)));

/* ---------- Usuarios del sistema (solo admin) ---------- */
r.get('/usuarios', soloAdmin, wrap(async (_req, res) =>
  res.json((await q('SELECT id,nombre,usuario,rol,activo FROM usuarios ORDER BY id')).rows)));
r.post('/usuarios', soloAdmin, wrap(async (req, res) => {
  const { nombre, usuario, password, rol } = req.body;
  if (!limpio(nombre) || !limpio(usuario)) throw new HttpError(400, 'Completa nombre y usuario');
  if (String(password || '').length < 6) throw new HttpError(400, 'La contraseña debe tener al menos 6 caracteres');
  const { rows: [row] } = await q(
    'INSERT INTO usuarios(nombre,usuario,password_hash,rol) VALUES($1,$2,$3,$4) RETURNING id',
    [nombre.trim(), usuario.toLowerCase().trim(), await bcrypt.hash(password, 10), rol === 'admin' ? 'admin' : 'responsable']);
  res.status(201).json(row);
}));
r.put('/usuarios/:id', soloAdmin, wrap(async (req, res) => {
  const { nombre, usuario, password, rol, activo } = req.body;
  if (password && password.length < 6) throw new HttpError(400, 'La contraseña debe tener al menos 6 caracteres');
  if (+req.params.id === req.user.id && (activo === false || rol !== 'admin'))
    throw new HttpError(400, 'No puedes quitarte el acceso de administrador a ti mismo');
  await q(`UPDATE usuarios SET nombre=$1, usuario=$2, rol=$3, activo=$4,
    password_hash = COALESCE($5, password_hash) WHERE id=$6`,
    [nombre?.trim(), usuario?.toLowerCase().trim(), rol === 'admin' ? 'admin' : 'responsable', activo !== false,
      password ? await bcrypt.hash(password, 10) : null, req.params.id]);
  res.json({ ok: true });
}));
r.delete('/usuarios/:id', soloAdmin, wrap(async (req, res) => {
  if (+req.params.id === req.user.id) throw new HttpError(400, 'No puedes eliminar tu propio usuario');
  await borrar('usuarios', req.params.id, res);
}));

/* ---------- Préstamos ---------- */
const PEND = '(i.cantidad - i.cantidad_devuelta - i.cantidad_perdida)';

r.get('/prestamos', wrap(async (req, res) => {
  const { estado, curso_id, desde, hasta, estudiante_id } = req.query;
  const busca = req.query.q;
  const p = [], w = [];
  if (estado === 'activo') w.push("p.estado='activo'");
  if (estado === 'devuelto') w.push("p.estado='devuelto'");
  if (estado === 'vencido') w.push("p.estado='activo' AND p.fecha_limite < now()");
  if (curso_id) { p.push(curso_id); w.push(`e.curso_id=$${p.length}`); }
  if (estudiante_id) { p.push(estudiante_id); w.push(`e.id=$${p.length}`); }
  if (desde) { p.push(desde); w.push(`p.fecha_prestamo >= $${p.length}::date`); }
  if (hasta) { p.push(hasta); w.push(`p.fecha_prestamo < ($${p.length}::date + 1)`); }
  if (busca) {
    p.push(`%${busca}%`);
    const n = p.length;
    w.push(`(e.nombres||' '||e.apellidos ILIKE $${n} OR e.ci ILIKE $${n} OR r.nombre ILIKE $${n})`);
  }
  const { rows } = await q(`
    SELECT p.id, p.fecha_prestamo, p.fecha_limite, p.fecha_cierre, p.estado, p.observaciones,
      (p.estado='activo' AND p.fecha_limite < now()) AS vencido,
      e.id AS estudiante_id, e.nombres||' '||e.apellidos AS estudiante, e.ci, c.nombre AS curso,
      r.nombre AS responsable,
      COALESCE(SUM(i.cantidad),0)::int AS total_items,
      COALESCE(SUM(${PEND}),0)::int AS pendientes
    FROM prestamos p
    JOIN estudiantes e ON e.id=p.estudiante_id
    JOIN cursos c ON c.id=e.curso_id
    JOIN responsables r ON r.id=p.responsable_id
    LEFT JOIN prestamo_items i ON i.prestamo_id=p.id
    ${w.length ? 'WHERE ' + w.join(' AND ') : ''}
    GROUP BY p.id, e.id, c.id, r.id
    ORDER BY p.fecha_prestamo DESC LIMIT 1000`, p);
  res.json(rows);
}));

r.get('/prestamos/:id', wrap(async (req, res) => {
  const { rows: [p] } = await q(`
    SELECT p.*, (p.estado='activo' AND p.fecha_limite < now()) AS vencido,
      e.nombres||' '||e.apellidos AS estudiante, e.ci, c.nombre AS curso, r.nombre AS responsable
    FROM prestamos p JOIN estudiantes e ON e.id=p.estudiante_id JOIN cursos c ON c.id=e.curso_id
    JOIN responsables r ON r.id=p.responsable_id WHERE p.id=$1`, [req.params.id]);
  if (!p) throw new HttpError(404, 'Préstamo no encontrado');
  const { rows: items } = await q(`
    SELECT i.id, i.cantidad, i.cantidad_devuelta, i.cantidad_perdida, ${PEND}::int AS pendiente, h.codigo, h.nombre
    FROM prestamo_items i JOIN herramientas h ON h.id=i.herramienta_id
    WHERE i.prestamo_id=$1 ORDER BY h.nombre`, [p.id]);
  res.json({ ...p, items });
}));

r.post('/prestamos', wrap(async (req, res) => {
  const { estudiante_id, responsable, fecha_limite, observaciones } = req.body;
  const nombreResp = String(responsable || '').trim();
  if (!estudiante_id || !nombreResp) throw new HttpError(400, 'Indica el estudiante y el responsable que presta');
  const limite = new Date(fecha_limite);
  if (Number.isNaN(limite.getTime())) throw new HttpError(400, 'La fecha límite no es válida');
  const mapa = new Map();
  for (const it of req.body.items || []) {
    const id = Number(it.herramienta_id), c = Math.floor(Number(it.cantidad));
    if (id && c > 0) mapa.set(id, (mapa.get(id) || 0) + c);
  }
  if (!mapa.size) throw new HttpError(400, 'Agrega al menos una herramienta');

  const id = await tx(async (db) => {
    const { rows: [resp] } = await db.query(
      'INSERT INTO responsables(nombre) VALUES($1) ON CONFLICT (lower(nombre)) DO UPDATE SET activo=true RETURNING id',
      [nombreResp]);
    const { rows: [pr] } = await db.query(
      `INSERT INTO prestamos(estudiante_id,responsable_id,registrado_por,fecha_limite,observaciones)
       VALUES($1,$2,$3,$4,$5) RETURNING id`,
      [estudiante_id, resp.id, req.user.id, limite, limpio(observaciones)]);
    for (const [hid, cant] of mapa) {
      const upd = await db.query(
        `UPDATE herramientas SET cantidad_disponible = cantidad_disponible - $1
         WHERE id=$2 AND activo AND cantidad_disponible >= $1 RETURNING id`, [cant, hid]);
      if (!upd.rowCount) {
        const { rows: [h] } = await db.query('SELECT nombre, cantidad_disponible FROM herramientas WHERE id=$1', [hid]);
        throw new HttpError(400, `No hay suficiente "${h?.nombre ?? hid}" (disponibles: ${h?.cantidad_disponible ?? 0})`);
      }
      await db.query('INSERT INTO prestamo_items(prestamo_id,herramienta_id,cantidad) VALUES($1,$2,$3)', [pr.id, hid, cant]);
    }
    return pr.id;
  });
  res.status(201).json({ id });
}));

r.post('/prestamos/:id/devolver', wrap(async (req, res) => {
  const out = await tx(async (db) => {
    const { rows: [p] } = await db.query('SELECT id, estado FROM prestamos WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!p) throw new HttpError(404, 'Préstamo no encontrado');
    if (p.estado === 'devuelto') throw new HttpError(400, 'Este préstamo ya fue devuelto completo');
    const { rows: items } = await db.query(
      `SELECT i.id, i.herramienta_id, (i.cantidad - i.cantidad_devuelta - i.cantidad_perdida) AS pendiente
       FROM prestamo_items i WHERE i.prestamo_id=$1 FOR UPDATE`, [p.id]);
    const pedido = req.body.todo
      ? items.map((i) => ({ item_id: i.id, devuelve: i.pendiente, perdidas: 0 }))
      : (req.body.items || []);
    let movidas = 0;
    for (const it of pedido) {
      const fila = items.find((x) => x.id === Number(it.item_id));
      const dev = Math.floor(Number(it.devuelve) || 0), per = Math.floor(Number(it.perdidas) || 0);
      if (!fila || (!dev && !per)) continue;
      if (dev < 0 || per < 0 || dev + per > fila.pendiente) throw new HttpError(400, 'Una cantidad supera lo que falta devolver');
      await db.query('UPDATE prestamo_items SET cantidad_devuelta=cantidad_devuelta+$1, cantidad_perdida=cantidad_perdida+$2 WHERE id=$3',
        [dev, per, fila.id]);
      // lo devuelto vuelve al stock; lo perdido sale del inventario
      await db.query('UPDATE herramientas SET cantidad_disponible=cantidad_disponible+$1, cantidad_total=cantidad_total-$2 WHERE id=$3',
        [dev, per, fila.herramienta_id]);
      movidas += dev + per;
    }
    if (!movidas) throw new HttpError(400, 'Indica qué herramientas se devuelven');
    const nota = limpio(req.body.nota);
    if (nota) await db.query("UPDATE prestamos SET observaciones = concat_ws(E'\\n', observaciones, $1::text) WHERE id=$2", [nota, p.id]);
    const { rows: [s] } = await db.query(
      `SELECT COALESCE(SUM(cantidad - cantidad_devuelta - cantidad_perdida),0)::int AS pend FROM prestamo_items WHERE prestamo_id=$1`, [p.id]);
    if (s.pend === 0) await db.query("UPDATE prestamos SET estado='devuelto', fecha_cierre=now() WHERE id=$1", [p.id]);
    return { completo: s.pend === 0, pendientes: s.pend };
  });
  res.json(out);
}));

r.get('/prestamos/:id/comprobante', wrap(async (req, res) =>
  toPdf(await getComprobante(req.params.id), res, `comprobante-${req.params.id}`)));

/* ---------- Alertas y panel ---------- */
const ALERTAS_SQL = `
  SELECT p.id, p.fecha_limite, e.nombres||' '||e.apellidos AS estudiante, c.nombre AS curso, r.nombre AS responsable,
    SUM(${PEND})::int AS pendientes,
    string_agg(h.nombre||' ×'||${PEND}, ', ' ORDER BY h.nombre) FILTER (WHERE ${PEND} > 0) AS detalle,
    (EXTRACT(EPOCH FROM (now() - p.fecha_limite)) / 60)::int AS minutos_atraso
  FROM prestamos p
  JOIN estudiantes e ON e.id=p.estudiante_id JOIN cursos c ON c.id=e.curso_id
  JOIN responsables r ON r.id=p.responsable_id
  JOIN prestamo_items i ON i.prestamo_id=p.id JOIN herramientas h ON h.id=i.herramienta_id
  WHERE p.estado='activo' AND p.fecha_limite < now()
  GROUP BY p.id, e.id, c.id, r.id
  ORDER BY p.fecha_limite`;

r.get('/alertas', wrap(async (_req, res) => res.json((await q(ALERTAS_SQL)).rows)));

r.get('/dashboard', wrap(async (_req, res) => {
  const [inv, pre, dias, top, cursos, venc] = await Promise.all([
    q(`SELECT COALESCE(SUM(cantidad_total),0)::int AS total, COALESCE(SUM(cantidad_disponible),0)::int AS disponibles,
        COUNT(*)::int AS tipos FROM herramientas WHERE activo`),
    q(`SELECT COUNT(*) FILTER (WHERE estado='activo')::int AS activos,
        COUNT(*) FILTER (WHERE estado='activo' AND fecha_limite < now())::int AS vencidos,
        COUNT(*) FILTER (WHERE fecha_prestamo::date = CURRENT_DATE)::int AS hoy,
        COUNT(*)::int AS total FROM prestamos`),
    q(`SELECT to_char(d.d,'DD/MM') AS dia, COALESCE(x.prestamos,0)::int AS prestamos, COALESCE(x.unidades,0)::int AS unidades
       FROM (SELECT (CURRENT_DATE - g) AS d FROM generate_series(0,13) g) d
       LEFT JOIN (SELECT p.fecha_prestamo::date AS f, COUNT(DISTINCT p.id) AS prestamos, SUM(i.cantidad) AS unidades
                  FROM prestamos p JOIN prestamo_items i ON i.prestamo_id=p.id GROUP BY 1) x ON x.f=d.d
       ORDER BY d.d`),
    q(`SELECT h.nombre, SUM(i.cantidad)::int AS unidades FROM prestamo_items i
       JOIN prestamos p ON p.id=i.prestamo_id JOIN herramientas h ON h.id=i.herramienta_id
       WHERE p.fecha_prestamo >= now() - interval '30 days' GROUP BY h.id ORDER BY unidades DESC, h.nombre LIMIT 8`),
    q(`SELECT c.nombre, COUNT(p.id)::int AS prestamos FROM cursos c
       LEFT JOIN estudiantes e ON e.curso_id=c.id
       LEFT JOIN prestamos p ON p.estudiante_id=e.id AND p.fecha_prestamo >= now() - interval '30 days'
       GROUP BY c.id ORDER BY c.id`),
    q(ALERTAS_SQL),
  ]);
  res.json({ inventario: inv.rows[0], prestamos: pre.rows[0], dias: dias.rows, top: top.rows, cursos: cursos.rows, vencidos: venc.rows });
}));

/* ---------- Reportes (json para vista previa, pdf, xlsx) ---------- */
r.get('/reportes/:tipo/:fmt', wrap(async (req, res) => {
  const rep = await getReport(req.params.tipo, req.query);
  const nombre = `${req.params.tipo}-${new Date().toISOString().slice(0, 10)}`;
  if (req.params.fmt === 'json') return res.json(rep);
  if (req.params.fmt === 'pdf') return toPdf(rep, res, nombre);
  if (req.params.fmt === 'xlsx') return toExcel(rep, res, nombre);
  throw new HttpError(404, 'Formato no disponible');
}));

export default r;
