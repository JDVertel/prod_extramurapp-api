import { pool } from "../utils/database.js";

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeDocument(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^([0-9]+)\.0+$/, "$1")
    .replace(/[^a-z0-9]/g, "");
}

function parseGrupos(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function facturadorVeTodos(gruposFacturador) {
  const grupos = parseGrupos(gruposFacturador);
  if (!grupos.length) return true;
  return grupos.some((g) => {
    const lower = g.toLowerCase();
    return lower === "f" || lower === "todos";
  });
}

function appendGrupoFilter(whereParts, params, gruposFacturador) {
  if (facturadorVeTodos(gruposFacturador)) {
    return;
  }

  const grupos = parseGrupos(gruposFacturador).filter((g) => {
    const lower = g.toLowerCase();
    return lower !== "f" && lower !== "todos";
  });

  if (!grupos.length) {
    whereParts.push("1 = 0");
    return;
  }

  // Coincide grupo exacto o grupo dentro de lista "1,2".
  const parts = grupos.map(() => "(TRIM(IFNULL(e.grupo, '')) = ? OR FIND_IN_SET(?, REPLACE(IFNULL(e.grupo, ''), ' ', '')) > 0)");
  whereParts.push(`(${parts.join(" OR ")})`);
  grupos.forEach((grupo) => {
    params.push(grupo, grupo);
  });
}

function appendIpsFilter(whereParts, params, ipsId) {
  const ips = normalizeText(ipsId);
  if (!ips) return;
  // No excluir históricos sin ips_id (comportamiento más tolerante que el dump filtrado estricto).
  whereParts.push("(e.ips_id = ? OR e.ips_id IS NULL OR TRIM(IFNULL(e.ips_id, '')) = '')");
  params.push(ips);
}

function appendConvenioFilter(whereParts, params, convenio) {
  const value = normalizeText(convenio);
  if (!value) return;
  whereParts.push("LOWER(TRIM(IFNULL(e.convenio, ''))) = LOWER(?)");
  params.push(value);
}

function appendPendienteFacturacionFilter(whereParts) {
  // La UI antigua trataba como pendiente todo lo que NO es true.
  whereParts.push("(e.status_facturacion = 0 OR e.status_facturacion IS NULL)");
}

function appendCerradoFacturacionFilter(whereParts) {
  whereParts.push("e.status_facturacion = 1");
  whereParts.push("e.fecha_facturacion IS NOT NULL");
}

function buildFacturadorMatchClause(params, idFacturador) {
  const raw = normalizeText(idFacturador);
  const norm = normalizeDocument(idFacturador);
  const candidates = Array.from(new Set([raw, norm].filter(Boolean)));

  if (!candidates.length) {
    return "1 = 0";
  }

  // Match exacto + variantes normalizadas sin REGEXP_REPLACE (compat MySQL/MariaDB).
  const encuestaParts = [];
  const cupsParts = [];

  candidates.forEach((candidate) => {
    encuestaParts.push("TRIM(IFNULL(e.asig_fact, '')) = ?");
    params.push(candidate);

    cupsParts.push("TRIM(IFNULL(ac.fact_prof, '')) = ?");
    params.push(candidate);
  });

  if (norm) {
    encuestaParts.push(
      "REPLACE(REPLACE(REPLACE(LOWER(TRIM(IFNULL(e.asig_fact, ''))), '.', ''), '-', ''), ' ', '') = ?"
    );
    params.push(norm);

    cupsParts.push(
      "REPLACE(REPLACE(REPLACE(LOWER(TRIM(IFNULL(ac.fact_prof, ''))), '.', ''), '-', ''), ' ', '') = ?"
    );
    params.push(norm);
  }

  return `(
    ${encuestaParts.join(" OR ")}
    OR EXISTS (
      SELECT 1
      FROM asignacion_cups ac
      WHERE ac.encuesta_id = e.id
        AND (${cupsParts.join(" OR ")})
    )
  )`;
}

/**
 * Pendientes del facturador: no cerrados y asignados por asig_fact o fact_prof.
 */
export async function listPendientesFacturacion({
  idFacturador,
  convenio = "",
  gruposFacturador = "",
  ipsId = null,
  limit = 2000,
} = {}) {
  const facturador = normalizeText(idFacturador);
  if (!facturador) {
    return [];
  }

  const whereParts = [];
  const params = [];

  appendPendienteFacturacionFilter(whereParts);
  appendIpsFilter(whereParts, params, ipsId);
  appendConvenioFilter(whereParts, params, convenio);
  appendGrupoFilter(whereParts, params, gruposFacturador);
  whereParts.push(buildFacturadorMatchClause(params, facturador));

  const safeLimit = Math.min(Math.max(Number(limit) || 2000, 1), 5000);
  params.push(safeLimit);

  const [rows] = await pool.query(
    `SELECT
       e.*,
       (
         SELECT COUNT(*)
         FROM asignacion_cups ac2
         WHERE ac2.encuesta_id = e.id
       ) AS cups_total,
       (
         SELECT COUNT(*)
         FROM asignacion_cups ac3
         WHERE ac3.encuesta_id = e.id
           AND NULLIF(TRIM(ac3.fact_num), '') IS NOT NULL
       ) AS cups_con_factura
     FROM encuestas e
     WHERE ${whereParts.join(" AND ")}
     ORDER BY e.updated_at DESC
     LIMIT ?`,
    params
  );

  return rows;
}

/**
 * Historial del facturador: cerrados en rango de fecha_facturacion.
 */
export async function listHistorialFacturacion({
  idFacturador,
  fechaInicio,
  fechaFin,
  convenio = "",
  gruposFacturador = "",
  ipsId = null,
  limit = 2000,
} = {}) {
  const facturador = normalizeText(idFacturador);
  const inicio = normalizeText(fechaInicio);
  const fin = normalizeText(fechaFin);
  if (!facturador || !inicio || !fin) {
    return [];
  }

  const whereParts = [
    "DATE(e.fecha_facturacion) >= ?",
    "DATE(e.fecha_facturacion) <= ?",
  ];
  const params = [inicio, fin];

  appendCerradoFacturacionFilter(whereParts);
  appendIpsFilter(whereParts, params, ipsId);
  appendConvenioFilter(whereParts, params, convenio);
  appendGrupoFilter(whereParts, params, gruposFacturador);
  whereParts.push(buildFacturadorMatchClause(params, facturador));

  const safeLimit = Math.min(Math.max(Number(limit) || 2000, 1), 5000);
  params.push(safeLimit);

  const [rows] = await pool.query(
    `SELECT
       e.*,
       (
         SELECT COUNT(*)
         FROM asignacion_cups ac2
         WHERE ac2.encuesta_id = e.id
       ) AS cups_total,
       (
         SELECT COUNT(*)
         FROM asignacion_cups ac3
         WHERE ac3.encuesta_id = e.id
           AND NULLIF(TRIM(ac3.fact_num), '') IS NOT NULL
       ) AS cups_con_factura
     FROM encuestas e
     WHERE ${whereParts.join(" AND ")}
     ORDER BY e.fecha_facturacion DESC, e.updated_at DESC
     LIMIT ?`,
    params
  );

  return rows;
}

/**
 * Informe de cuentas del facturador: filas para agregación en rango de cierre.
 */
export async function listInformeCerradosFacturacion({
  idFacturador,
  fechaInicio,
  fechaFin,
  convenio = "",
  gruposFacturador = "",
  ipsId = null,
  limit = 50000,
} = {}) {
  const facturador = normalizeText(idFacturador);
  const inicio = normalizeText(fechaInicio);
  const fin = normalizeText(fechaFin);
  if (!facturador || !inicio || !fin) {
    return [];
  }

  const whereParts = [
    "DATE(e.fecha_facturacion) >= ?",
    "DATE(e.fecha_facturacion) <= ?",
  ];
  const params = [inicio, fin];

  appendCerradoFacturacionFilter(whereParts);
  appendIpsFilter(whereParts, params, ipsId);
  appendConvenioFilter(whereParts, params, convenio);
  appendGrupoFilter(whereParts, params, gruposFacturador);
  whereParts.push(buildFacturadorMatchClause(params, facturador));

  const safeLimit = Math.min(Math.max(Number(limit) || 50000, 1), 50000);
  params.push(safeLimit);

  const [rows] = await pool.query(
    `SELECT
       e.id AS encuestaId,
       e.convenio,
       e.grupo,
       e.eps,
       e.regimen,
       e.nombre1,
       e.nombre2,
       e.apellido1,
       e.apellido2,
       e.tipodoc,
       e.numdoc,
       e.fecha_facturacion AS fechaCierrePaciente,
       e.asig_fact AS asigFact,
       ac.id AS asignacionCupId,
       ac.actividad_id AS actividadId,
       COALESCE(NULLIF(TRIM(ae.nombre), ''), NULLIF(TRIM(ac.actividad_id), ''), 'Sin actividad') AS actividadNombre,
       ac.cups_id AS cupsId,
       ac.cups_codigo AS cupsCodigo,
       ac.cups_nombre AS cupsNombre,
       ac.cups_grupo AS cupsGrupo,
       ac.cantidad,
       ac.detalle,
       ac.fact_num AS factNum,
       ac.fact_prof AS factProf,
       ac.facturado,
       ac.fecha_facturacion AS fechaFacturacionCup,
       ac.key_ref AS profesionalRol,
       ac.nombre_prof AS profesionalNombre
     FROM encuestas e
     LEFT JOIN asignacion_cups ac ON ac.encuesta_id = e.id
     LEFT JOIN actividades_extra ae ON (
       ae.clave COLLATE utf8mb4_unicode_ci = ac.actividad_id COLLATE utf8mb4_unicode_ci
       OR ae.id COLLATE utf8mb4_unicode_ci = ac.actividad_id COLLATE utf8mb4_unicode_ci
     )
     WHERE ${whereParts.join(" AND ")}
     ORDER BY e.fecha_facturacion DESC, e.id DESC, ac.cups_codigo ASC, ac.cups_nombre ASC
     LIMIT ?`,
    params
  );

  return rows;
}

/**
 * Disponibles para aprovisionar por rango de fecha_gest_enfermera (sin asig_fact).
 */
export async function listDisponiblesFacturacionPorRango({
  fechaInicio,
  fechaFin,
  convenio = "",
  gruposFacturador = "",
  ipsId = null,
  limit = 2000,
} = {}) {
  const inicio = normalizeText(fechaInicio);
  const fin = normalizeText(fechaFin);
  if (!inicio || !fin) {
    return [];
  }

  const whereParts = [
    "(e.asig_fact IS NULL OR TRIM(e.asig_fact) = '')",
    "e.fecha_gest_enfermera IS NOT NULL",
    "DATE(e.fecha_gest_enfermera) >= ?",
    "DATE(e.fecha_gest_enfermera) <= ?",
  ];
  const params = [inicio, fin];

  appendPendienteFacturacionFilter(whereParts);
  appendIpsFilter(whereParts, params, ipsId);
  appendConvenioFilter(whereParts, params, convenio);
  appendGrupoFilter(whereParts, params, gruposFacturador);

  const safeLimit = Math.min(Math.max(Number(limit) || 2000, 1), 5000);
  params.push(safeLimit);

  const [rows] = await pool.query(
    `SELECT e.*
     FROM encuestas e
     WHERE ${whereParts.join(" AND ")}
     ORDER BY e.fecha_gest_enfermera DESC, e.updated_at DESC
     LIMIT ?`,
    params
  );

  return rows;
}

/**
 * Disponibles para aprovisionar por documento del paciente (sin asig_fact).
 */
export async function listDisponiblesFacturacionPorDocumento({
  tipodoc,
  numdoc,
  convenio = "",
  gruposFacturador = "",
  ipsId = null,
  limit = 200,
} = {}) {
  const tipo = normalizeText(tipodoc);
  const doc = normalizeText(numdoc);
  if (!tipo || !doc) {
    return [];
  }

  const docNorm = normalizeDocument(doc);
  const whereParts = [
    "(e.asig_fact IS NULL OR TRIM(e.asig_fact) = '')",
    "LOWER(TRIM(IFNULL(e.tipodoc, ''))) = LOWER(?)",
    `(
      TRIM(IFNULL(e.numdoc, '')) = ?
      OR REPLACE(REPLACE(REPLACE(LOWER(TRIM(IFNULL(e.numdoc, ''))), '.', ''), '-', ''), ' ', '') = ?
    )`,
  ];
  const params = [tipo, doc, docNorm];

  appendPendienteFacturacionFilter(whereParts);
  appendIpsFilter(whereParts, params, ipsId);
  appendConvenioFilter(whereParts, params, convenio);
  appendGrupoFilter(whereParts, params, gruposFacturador);

  const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 1000);
  params.push(safeLimit);

  const [rows] = await pool.query(
    `SELECT e.*
     FROM encuestas e
     WHERE ${whereParts.join(" AND ")}
     ORDER BY e.updated_at DESC
     LIMIT ?`,
    params
  );

  return rows;
}
