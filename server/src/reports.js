import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { q } from './db.js';
import { HttpError } from './errors.js';

const FECHA = (c) => `to_char(${c},'DD/MM/YYYY HH24:MI')`;
const PEND = '(i.cantidad - i.cantidad_devuelta - i.cantidad_perdida)';
const ESTADO = `CASE WHEN p.estado='devuelto' THEN 'Devuelto' WHEN p.fecha_limite < now() THEN 'VENCIDO' ELSE 'Activo' END`;
const numerar = (rows) => rows.map((r, i) => ({ n: i + 1, ...r }));
const N = { key: 'n', header: 'N°', w: 0.45, align: 'right' };

function filtros({ desde, hasta, curso_id }, params) {
  const w = [];
  if (desde) { params.push(desde); w.push(`p.fecha_prestamo >= $${params.length}::date`); }
  if (hasta) { params.push(hasta); w.push(`p.fecha_prestamo < ($${params.length}::date + 1)`); }
  if (curso_id) { params.push(curso_id); w.push(`e.curso_id = $${params.length}`); }
  return w;
}

const DESDE = `FROM prestamos p
  JOIN estudiantes e ON e.id=p.estudiante_id JOIN cursos c ON c.id=e.curso_id
  JOIN responsables r ON r.id=p.responsable_id
  JOIN prestamo_items i ON i.prestamo_id=p.id JOIN herramientas h ON h.id=i.herramienta_id`;

export async function getReport(tipo, f = {}) {
  const params = [];
  const w = filtros(f, params);
  let curso = '';
  if (f.curso_id) {
    const { rows: [c] } = await q('SELECT nombre FROM cursos WHERE id=$1', [f.curso_id]);
    if (c) curso = ` · ${c.nombre}`;
  }
  const periodo = (f.desde || f.hasta) ? `Periodo: ${f.desde || 'inicio'} al ${f.hasta || 'hoy'}` : 'Periodo: todo el historial';
  const sub = periodo + curso;
  const donde = (extra = []) => { const t = [...w, ...extra]; return t.length ? 'WHERE ' + t.join(' AND ') : ''; };

  if (tipo === 'prestamos') {
    const { rows } = await q(`
      SELECT ${FECHA('p.fecha_prestamo')} AS fecha, e.nombres||' '||e.apellidos AS estudiante, c.nombre AS curso,
        r.nombre AS responsable, string_agg(h.nombre||' ×'||i.cantidad, ', ' ORDER BY h.nombre) AS herramientas,
        SUM(i.cantidad)::int AS total, SUM(${PEND})::int AS pendientes, ${ESTADO} AS estado
      ${DESDE} ${donde()} GROUP BY p.id, e.id, c.id, r.id ORDER BY p.fecha_prestamo DESC`, params);
    const tot = rows.reduce((a, x) => a + x.total, 0), pen = rows.reduce((a, x) => a + x.pendientes, 0);
    return {
      title: 'Historial de préstamos', subtitle: sub,
      columns: [N,
        { key: 'fecha', header: 'Fecha', w: 1.15 }, { key: 'estudiante', header: 'Estudiante', w: 1.6 },
        { key: 'curso', header: 'Curso', w: 1.1 }, { key: 'responsable', header: 'Responsable', w: 1.3 },
        { key: 'herramientas', header: 'Herramientas', w: 3.2 }, { key: 'total', header: 'Total', w: 0.6, align: 'right' },
        { key: 'pendientes', header: 'Falta', w: 0.6, align: 'right' }, { key: 'estado', header: 'Estado', w: 0.9 }],
      rows: numerar(rows),
      resumen: [`Préstamos: ${rows.length}`, `Herramientas prestadas (unidades): ${tot}`, `Sin devolver: ${pen}`],
    };
  }

  if (tipo === 'uso') {
    const { rows } = await q(`
      SELECT h.codigo, h.nombre AS herramienta, COALESCE(cat.nombre,'—') AS categoria,
        COUNT(DISTINCT p.id)::int AS veces, SUM(i.cantidad)::int AS unidades, COUNT(DISTINCT e.id)::int AS estudiantes
      ${DESDE} LEFT JOIN categorias cat ON cat.id=h.categoria_id ${donde()}
      GROUP BY h.id, cat.nombre ORDER BY unidades DESC, h.nombre`, params);
    return {
      title: 'Herramientas utilizadas', subtitle: sub,
      columns: [N, { key: 'codigo', header: 'Código', w: 0.9 }, { key: 'herramienta', header: 'Herramienta', w: 2.4 },
        { key: 'categoria', header: 'Categoría', w: 1.6 }, { key: 'veces', header: 'Veces prestada', w: 1, align: 'right' },
        { key: 'unidades', header: 'Unidades', w: 0.9, align: 'right' }, { key: 'estudiantes', header: 'Estudiantes', w: 1, align: 'right' }],
      rows: numerar(rows),
      resumen: [`Herramientas distintas usadas: ${rows.length}`, `Unidades prestadas en total: ${rows.reduce((a, x) => a + x.unidades, 0)}`],
    };
  }

  if (tipo === 'pendientes') {
    const { rows } = await q(`
      SELECT e.nombres||' '||e.apellidos AS estudiante, c.nombre AS curso, r.nombre AS responsable,
        h.codigo, h.nombre AS herramienta, ${PEND}::int AS pendiente,
        ${FECHA('p.fecha_prestamo')} AS prestado, ${FECHA('p.fecha_limite')} AS limite,
        CASE WHEN p.fecha_limite < now() THEN 'VENCIDO' ELSE 'En plazo' END AS estado
      ${DESDE} ${donde(["p.estado='activo'", `${PEND} > 0`])} ORDER BY p.fecha_limite, e.apellidos`, params);
    return {
      title: 'Herramientas que faltan por devolver', subtitle: sub + ' · Estado actual',
      columns: [N, { key: 'estudiante', header: 'Estudiante', w: 1.7 }, { key: 'curso', header: 'Curso', w: 1.1 },
        { key: 'responsable', header: 'Responsable', w: 1.3 }, { key: 'codigo', header: 'Código', w: 0.8 },
        { key: 'herramienta', header: 'Herramienta', w: 2 }, { key: 'pendiente', header: 'Falta', w: 0.55, align: 'right' },
        { key: 'prestado', header: 'Prestado', w: 1.1 }, { key: 'limite', header: 'Devolver antes de', w: 1.1 },
        { key: 'estado', header: 'Estado', w: 0.8 }],
      rows: numerar(rows),
      resumen: [`Registros pendientes: ${rows.length}`, `Unidades que faltan: ${rows.reduce((a, x) => a + x.pendiente, 0)}`,
        `Vencidos: ${rows.filter((x) => x.estado === 'VENCIDO').length}`],
    };
  }

  if (tipo === 'inventario') {
    const { rows } = await q(`
      SELECT h.codigo, h.nombre, COALESCE(c.nombre,'—') AS categoria, h.cantidad_total AS total,
        h.cantidad_disponible AS disponibles, (h.cantidad_total - h.cantidad_disponible) AS prestadas,
        h.estado, COALESCE(h.ubicacion,'—') AS ubicacion
      FROM herramientas h LEFT JOIN categorias c ON c.id=h.categoria_id WHERE h.activo
      ORDER BY c.nombre NULLS LAST, h.nombre`);
    return {
      title: 'Inventario de herramientas', subtitle: 'Estado actual del taller',
      columns: [N, { key: 'codigo', header: 'Código', w: 0.9 }, { key: 'nombre', header: 'Herramienta', w: 2.6 },
        { key: 'categoria', header: 'Categoría', w: 1.6 }, { key: 'total', header: 'Total', w: 0.6, align: 'right' },
        { key: 'disponibles', header: 'Disponibles', w: 0.9, align: 'right' }, { key: 'prestadas', header: 'Prestadas', w: 0.8, align: 'right' },
        { key: 'estado', header: 'Estado', w: 0.8 }, { key: 'ubicacion', header: 'Ubicación', w: 1.1 }],
      rows: numerar(rows),
      resumen: [`Tipos de herramienta: ${rows.length}`, `Unidades en total: ${rows.reduce((a, x) => a + x.total, 0)}`,
        `Disponibles: ${rows.reduce((a, x) => a + x.disponibles, 0)}`, `Prestadas: ${rows.reduce((a, x) => a + x.prestadas, 0)}`],
    };
  }
  throw new HttpError(404, 'Ese reporte no existe');
}

export async function getComprobante(id) {
  const { rows: [p] } = await q(`
    SELECT p.id, ${FECHA('p.fecha_prestamo')} AS fecha, ${FECHA('p.fecha_limite')} AS limite,
      e.nombres||' '||e.apellidos AS estudiante, e.ci, c.nombre AS curso, r.nombre AS responsable, p.observaciones
    FROM prestamos p JOIN estudiantes e ON e.id=p.estudiante_id JOIN cursos c ON c.id=e.curso_id
    JOIN responsables r ON r.id=p.responsable_id WHERE p.id=$1`, [id]);
  if (!p) throw new HttpError(404, 'Préstamo no encontrado');
  const { rows } = await q(`
    SELECT h.codigo, h.nombre, i.cantidad, i.cantidad_devuelta AS devueltas, ${PEND}::int AS pendientes
    FROM prestamo_items i JOIN herramientas h ON h.id=i.herramienta_id WHERE i.prestamo_id=$1 ORDER BY h.nombre`, [id]);
  return {
    title: `Comprobante de préstamo N° ${String(p.id).padStart(5, '0')}`,
    subtitle: `Fecha: ${p.fecha} · Devolver antes de: ${p.limite}`,
    meta: [`Estudiante: ${p.estudiante} (CI ${p.ci})`, `Curso: ${p.curso}`, `Responsable que presta: ${p.responsable}`,
      ...(p.observaciones ? [`Observaciones: ${p.observaciones}`] : [])],
    columns: [N, { key: 'codigo', header: 'Código', w: 1 }, { key: 'nombre', header: 'Herramienta', w: 3 },
      { key: 'cantidad', header: 'Cant.', w: 0.7, align: 'right' }, { key: 'devueltas', header: 'Devueltas', w: 0.9, align: 'right' },
      { key: 'pendientes', header: 'Faltan', w: 0.8, align: 'right' }],
    rows: numerar(rows),
    resumen: [`Total de herramientas: ${rows.reduce((a, x) => a + x.cantidad, 0)}`],
    firmas: ['Estudiante', 'Responsable del taller'],
  };
}

/* ---------------- PDF ---------------- */
export function toPdf(rep, res, nombre) {
  const horizontal = rep.columns.length > 6;
  const doc = new PDFDocument({ size: 'A4', layout: horizontal ? 'landscape' : 'portrait', margin: 36, bufferPages: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${nombre}.pdf"`);
  doc.pipe(res);

  const L = 36, W = doc.page.width - 72, fondo = () => doc.page.height - 56;
  const suma = rep.columns.reduce((s, c) => s + (c.w || 1), 0);
  const cols = rep.columns.map((c) => ({ ...c, ancho: ((c.w || 1) / suma) * W }));

  const encabezado = () => {
    doc.rect(L, 30, W, 50).fill('#1c232b');
    doc.rect(L, 30, 8, 50).fill('#ffbe0b');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(14).text('ESFM · Taller de Mecánica Automotriz', L + 22, 40, { width: W - 40 });
    doc.font('Helvetica').fontSize(9).fillColor('#cbd5e1').text('Control de préstamo de herramientas', L + 22, 60, { width: W - 40 });
    doc.fillColor('#1c232b');
    return 94;
  };
  const cabeceraTabla = (y) => {
    doc.rect(L, y, W, 22).fill('#2d5f8b');
    let x = L;
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8);
    for (const c of cols) {
      doc.text(c.header, x + 4, y + 7, { width: c.ancho - 8, align: c.align || 'left', lineBreak: false, ellipsis: true });
      x += c.ancho;
    }
    return y + 22;
  };

  let y = encabezado();
  doc.font('Helvetica-Bold').fontSize(15).fillColor('#1c232b').text(rep.title, L, y, { width: W });
  y = doc.y + 2;
  doc.font('Helvetica').fontSize(9).fillColor('#4b5563')
    .text(`${rep.subtitle} · Generado: ${new Date().toLocaleString('es-BO', { timeZone: 'America/La_Paz' })}`, L, y, { width: W });
  y = doc.y + 6;
  for (const m of rep.meta || []) {
    doc.font('Helvetica').fontSize(10).fillColor('#1c232b').text(m, L, y, { width: W });
    y = doc.y + 2;
  }
  y = cabeceraTabla(y + 6);

  doc.font('Helvetica').fontSize(8);
  rep.rows.forEach((row, idx) => {
    const textos = cols.map((c) => String(row[c.key] ?? ''));
    const h = Math.max(18, ...textos.map((t, i) => doc.heightOfString(t, { width: cols[i].ancho - 8 }) + 8));
    if (y + h > fondo()) {
      doc.addPage();
      y = cabeceraTabla(encabezado());
      doc.font('Helvetica').fontSize(8);
    }
    if (idx % 2 === 0) doc.rect(L, y, W, h).fill('#eef1f4');
    doc.fillColor(row.estado === 'VENCIDO' ? '#b42318' : '#1c232b');
    let x = L;
    textos.forEach((t, i) => { doc.text(t, x + 4, y + 4, { width: cols[i].ancho - 8, align: cols[i].align || 'left' }); x += cols[i].ancho; });
    y += h;
  });
  if (!rep.rows.length) { doc.fillColor('#4b5563').fontSize(10).text('No hay registros para este reporte.', L, y + 10); y = doc.y; }

  y += 12;
  if (rep.resumen?.length) {
    if (y + 16 * rep.resumen.length > fondo()) { doc.addPage(); y = encabezado(); }
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#1c232b');
    for (const t of rep.resumen) { doc.text(t, L, y, { width: W }); y = doc.y + 3; }
  }
  if (rep.firmas) {
    if (y + 110 > fondo()) { doc.addPage(); y = encabezado(); }
    y += 70;
    const mitad = W / rep.firmas.length;
    rep.firmas.forEach((t, i) => {
      const x = L + i * mitad + 30;
      doc.moveTo(x, y).lineTo(x + mitad - 60, y).lineWidth(0.8).strokeColor('#1c232b').stroke();
      doc.font('Helvetica').fontSize(9).fillColor('#1c232b').text(t, x, y + 5, { width: mitad - 60, align: 'center' });
    });
  }

  const pags = doc.bufferedPageRange();
  for (let i = 0; i < pags.count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0; // permite escribir el pie sin crear otra página
    doc.font('Helvetica').fontSize(8).fillColor('#6b7280')
      .text(`Página ${i + 1} de ${pags.count}`, L, doc.page.height - 30, { width: W, align: 'right', lineBreak: false });
  }
  doc.end();
}

/* ---------------- Excel ---------------- */
export async function toExcel(rep, res, nombre) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Taller de Mecánica Automotriz · ESFM';
  const ws = wb.addWorksheet(rep.title.replace(/[\\/?*[\]:]/g, '').slice(0, 31));
  const n = rep.columns.length;
  ws.mergeCells(1, 1, 1, n);
  ws.getCell('A1').value = `ESFM · Taller de Mecánica Automotriz — ${rep.title}`;
  ws.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF1C232B' } };
  ws.mergeCells(2, 1, 2, n);
  ws.getCell('A2').value = rep.subtitle;
  ws.getCell('A2').font = { color: { argb: 'FF4B5563' } };
  const cab = ws.getRow(4);
  rep.columns.forEach((c, i) => {
    const cell = cab.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D5F8B' } };
    cell.alignment = { horizontal: c.align === 'right' ? 'right' : 'left', vertical: 'middle' };
    ws.getColumn(i + 1).width = Math.max(8, Math.round((c.w || 1) * 14));
  });
  cab.height = 22;
  for (const row of rep.rows) {
    const fila = ws.addRow(rep.columns.map((c) => row[c.key]));
    if (row.estado === 'VENCIDO') fila.font = { color: { argb: 'FFB42318' }, bold: true };
  }
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: n } };
  ws.views = [{ state: 'frozen', ySplit: 4 }];
  ws.addRow([]);
  for (const t of rep.resumen || []) ws.addRow([t]).font = { bold: true };

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${nombre}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
}
