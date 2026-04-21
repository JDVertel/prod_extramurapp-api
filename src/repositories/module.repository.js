import { randomUUID } from "node:crypto";
import { pool } from "../utils/database.js";
import { getRealtimeValue } from "../services/realtime-store.service.js";
import {
  MODULES,
  normalizeModulePayload,
  prepareModuleValue,
  toModuleRow,
} from "../models/module.model.js";

export function getModuleConfig(moduleName) {
  const config = MODULES[moduleName] || null;
  return config ? { ...config, moduleName } : null;
}

function hasIpsColumn(config) {
  return Array.isArray(config?.columns) && config.columns.includes("ips_id");
}

let ipsCodColumnCache;
let ipsExistingColumnsCache;
const tableExistingColumnsCache = new Map();
const tablePkAutoIncrementCache = new Map();
const tablePkNumericCache = new Map();
let asignacionCupsFacturacionColumnsEnsured = false;
let deletedRecordsTableEnsured = false;

async function ensureDeletedRecordsTable() {
  if (deletedRecordsTableEnsured) {
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS deleted_records (
      id VARCHAR(36) PRIMARY KEY,
      module_name VARCHAR(80) NOT NULL,
      record_id VARCHAR(80) NOT NULL,
      ips_id VARCHAR(36) NULL,
      deleted_by VARCHAR(120) NULL,
      payload_json LONGTEXT NOT NULL,
      deleted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_deleted_records_module (module_name),
      INDEX idx_deleted_records_record (record_id),
      INDEX idx_deleted_records_deleted_at (deleted_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  deletedRecordsTableEnsured = true;
}

async function ensureAsignacionCupsFacturacionColumns() {
  if (asignacionCupsFacturacionColumnsEnsured) {
    return;
  }

  try {
    const existing = await resolveTableExistingColumns("asignacion_cups");

    const required = [
      { name: "fact_num", ddl: "VARCHAR(80) NULL" },
      { name: "fact_prof", ddl: "VARCHAR(36) NULL" },
      { name: "facturado", ddl: "TINYINT(1) NULL" },
      { name: "fecha_facturacion", ddl: "DATETIME NULL" },
    ];

    for (const col of required) {
      if (existing.has(col.name)) {
        continue;
      }

      try {
        await pool.query(`ALTER TABLE asignacion_cups ADD COLUMN ${col.name} ${col.ddl}`);
        existing.add(col.name);
      } catch (alterError) {
        // Si otra instancia ya la creó en paralelo, seguir.
        if (alterError?.code !== "ER_DUP_FIELDNAME") {
          throw alterError;
        }
      }
    }

    tableExistingColumnsCache.set("asignacion_cups", existing);
  } catch (error) {
    console.warn("No se pudieron asegurar columnas de facturación en asignacion_cups", {
      message: error?.message,
      code: error?.code,
    });
  }

  asignacionCupsFacturacionColumnsEnsured = true;
}

async function resolveTableExistingColumns(tableName) {
  if (tableExistingColumnsCache.has(tableName)) {
    return tableExistingColumnsCache.get(tableName);
  }

  const [rows] = await pool.query(`SHOW COLUMNS FROM ${tableName}`);
  const existing = new Set(rows.map((row) => String(row.Field || "").trim()).filter(Boolean));
  tableExistingColumnsCache.set(tableName, existing);
  return existing;
}

async function isPkAutoIncrement(tableName, pkColumn) {
  const cacheKey = `${tableName}.${pkColumn}`;
  if (tablePkAutoIncrementCache.has(cacheKey)) {
    return tablePkAutoIncrementCache.get(cacheKey);
  }

  const [rows] = await pool.query(`SHOW COLUMNS FROM ${tableName} LIKE ?`, [pkColumn]);
  const isAuto = rows.length
    ? String(rows[0].Extra || "").toLowerCase().includes("auto_increment")
    : false;

  tablePkAutoIncrementCache.set(cacheKey, isAuto);
  return isAuto;
}

async function isPkNumeric(tableName, pkColumn) {
  const cacheKey = `${tableName}.${pkColumn}`;
  if (tablePkNumericCache.has(cacheKey)) {
    return tablePkNumericCache.get(cacheKey);
  }

  const [rows] = await pool.query(`SHOW COLUMNS FROM ${tableName} LIKE ?`, [pkColumn]);
  const colType = rows.length ? String(rows[0].Type || "").toLowerCase() : "";
  const numeric = /^(tinyint|smallint|mediumint|int|bigint|decimal|numeric)/.test(colType);

  tablePkNumericCache.set(cacheKey, numeric);
  return numeric;
}

function generateNumericId() {
  const base = BigInt(Date.now()) * 1000n;
  const rand = BigInt(Math.floor(Math.random() * 1000));
  return Number(base + rand);
}

async function resolveIpsCodColumn() {
  if (ipsCodColumnCache !== undefined) {
    return ipsCodColumnCache;
  }

  const [snakeRows] = await pool.query("SHOW COLUMNS FROM ips LIKE 'cod_hab'");
  if (snakeRows.length) {
    ipsCodColumnCache = "cod_hab";
    return ipsCodColumnCache;
  }

  const [camelRows] = await pool.query("SHOW COLUMNS FROM ips LIKE 'codHab'");
  if (camelRows.length) {
    ipsCodColumnCache = "codHab";
    return ipsCodColumnCache;
  }

  ipsCodColumnCache = null;
  return ipsCodColumnCache;
}

async function resolveIpsExistingColumns() {
  if (ipsExistingColumnsCache) {
    return ipsExistingColumnsCache;
  }

  const [rows] = await pool.query("SHOW COLUMNS FROM ips");
  ipsExistingColumnsCache = new Set(rows.map((row) => String(row.Field || "").trim()).filter(Boolean));
  return ipsExistingColumnsCache;
}

async function resolveAllowedColumns(config, excluded = []) {
  const baseColumns = (config.columns || []).filter((col) => !excluded.includes(col));
  const existing = await resolveTableExistingColumns(config.table);

  if (config.moduleName !== "ips") {
    return baseColumns.filter((col) => existing.has(col));
  }

  const ipsExisting = await resolveIpsExistingColumns();
  const codColumn = await resolveIpsCodColumn();
  const noLegacy = baseColumns.filter((col) => col !== "cod_hab" && col !== "codHab");
  if (codColumn) {
    noLegacy.push(codColumn);
  }

  return noLegacy.filter((col) => existing.has(col) && ipsExisting.has(col));
}

async function normalizeIpsCodField(config, normalized) {
  if (config.moduleName !== "ips") {
    return;
  }

  const codColumn = await resolveIpsCodColumn();
  const codValue = normalized.cod_hab ?? normalized.codHab;
  delete normalized.cod_hab;
  delete normalized.codHab;

  if (codColumn && codValue !== undefined) {
    normalized[codColumn] = codValue;
  }
}

function normalizeIpsId(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function normalizeArray(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (value && typeof value === "object") {
    return Object.values(value).filter(Boolean);
  }

  return [];
}

function normalizeText(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const out = String(value).trim();
  return out || null;
}

function normalizeTextLen(value, maxLen) {
  const out = normalizeText(value);
  if (!out) {
    return null;
  }
  return out.length > maxLen ? out.slice(0, maxLen) : out;
}

function normalizeBooleanFilter(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  const raw = String(value).trim().toLowerCase();
  if (!raw) {
    return null;
  }

  if (["1", "true", "si", "sí", "yes"].includes(raw)) {
    return 1;
  }

  if (["0", "false", "no"].includes(raw)) {
    return 0;
  }

  const parsed = Number(raw);
  if (Number.isFinite(parsed)) {
    return parsed >= 1 ? 1 : 0;
  }

  return null;
}

function getFirstFilterValue(filters = {}, keys = []) {
  for (const key of keys) {
    if (filters?.[key] !== undefined && filters?.[key] !== null && String(filters[key]).trim() !== "") {
      return filters[key];
    }
  }

  return null;
}

function resolveDeletedBy(actor = null) {
  return normalizeTextLen(
    actor?.id ?? actor?.uid ?? actor?.documento ?? actor?.numdoc ?? actor?.email,
    120
  );
}

async function archiveDeletedModuleRow(moduleName, recordId, payload, { ipsId = null, actor = null } = {}) {
  if (!payload) {
    return;
  }

  await ensureDeletedRecordsTable();

  await pool.query(
    `INSERT INTO deleted_records (id, module_name, record_id, ips_id, deleted_by, payload_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      normalizeTextLen(moduleName, 80) || "desconocido",
      normalizeTextLen(recordId, 80) || randomUUID(),
      normalizeIpsId(ipsId ?? payload?.ipsId ?? payload?.ips_id),
      resolveDeletedBy(actor),
      JSON.stringify(payload),
    ]
  );
}

async function resolveEncuestaIpsId(encuestaId, fallbackIpsId = null) {
  const encuestaIdNorm = normalizeTextLen(encuestaId, 36);
  const fallbackNorm = normalizeIpsId(fallbackIpsId);

  if (!encuestaIdNorm) {
    return fallbackNorm;
  }

  try {
    const [rows] = await pool.query(
      `SELECT ips_id FROM encuestas WHERE id = ? LIMIT 1`,
      [encuestaIdNorm]
    );

    const encuestaIpsId = normalizeIpsId(rows?.[0]?.ips_id);
    return encuestaIpsId || fallbackNorm;
  } catch (error) {
    console.warn("No se pudo resolver ips_id desde encuestas", {
      encuestaId: encuestaIdNorm,
      message: error?.message,
    });
    return fallbackNorm;
  }
}

function extractActividadKeysFromLegacyPayload(payload = null) {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const tipoActividad = payload?.tipoActividad && typeof payload.tipoActividad === "object"
    ? payload.tipoActividad
    : payload;

  if (!tipoActividad || typeof tipoActividad !== "object") {
    return [];
  }

  const keys = new Set();

  Object.entries(tipoActividad).forEach(([actividadId, actividad]) => {
    if (typeof actividad === "string") {
      const key = normalizeTextLen(actividad, 60);
      if (key) keys.add(key);
      return;
    }

    if (typeof actividad === "boolean") {
      if (actividad) {
        const key = normalizeTextLen(actividadId, 60);
        if (key) keys.add(key);
      }
      return;
    }

    if (actividad && typeof actividad === "object") {
      const key = normalizeTextLen(
        actividad.key ?? actividad.clave ?? actividad.actividadKey ?? actividad.actividadId ?? actividadId,
        60
      );
      if (key) keys.add(key);
      return;
    }

    const fallbackKey = normalizeTextLen(actividadId, 60);
    if (fallbackKey) {
      keys.add(fallbackKey);
    }
  });

  return Array.from(keys);
}

async function listActividadKeysFromAsignacionHistory(encuestaId) {
  const encuestaIdNorm = normalizeTextLen(encuestaId, 36);
  if (!encuestaIdNorm) {
    return [];
  }

  const keys = new Set();

  try {
    const [rows] = await pool.query(
      `SELECT DISTINCT actividad_id
       FROM asignacion_cups
       WHERE encuesta_id = ?
         AND actividad_id IS NOT NULL
         AND actividad_id <> ''`,
      [encuestaIdNorm]
    );

    rows.forEach((row) => {
      const key = normalizeTextLen(row?.actividad_id, 60);
      if (key) {
        keys.add(key);
      }
    });
  } catch (error) {
    console.warn("No se pudo leer historial de actividades desde asignacion_cups", {
      encuestaId: encuestaIdNorm,
      message: error?.message,
    });
  }

  return Array.from(keys);
}

async function hydrateEncuestaActividadesFromHistory(encuestaId, ipsId = null) {
  const encuestaIdNorm = normalizeTextLen(encuestaId, 36);
  if (!encuestaIdNorm) {
    return 0;
  }

  const effectiveIpsId = await resolveEncuestaIpsId(encuestaIdNorm, ipsId);

  let legacyPayload = null;
  try {
    legacyPayload = await getRealtimeValue(`Actividades/${encuestaIdNorm}`);
  } catch (error) {
    console.warn("No se pudo leer histórico realtime para encuesta_actividades", {
      encuestaId: encuestaIdNorm,
      message: error?.message,
    });
  }

  const actividadKeys = new Set(extractActividadKeysFromLegacyPayload(legacyPayload));
  const assignmentKeys = await listActividadKeysFromAsignacionHistory(encuestaIdNorm);
  assignmentKeys.forEach((key) => actividadKeys.add(key));

  if (!actividadKeys.size) {
    return 0;
  }

  for (const actividadKey of actividadKeys) {
    await pool.query(
      `INSERT INTO encuesta_actividades (id, encuesta_id, ips_id, actividad_key)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         ips_id = COALESCE(VALUES(ips_id), ips_id),
         actividad_key = VALUES(actividad_key)`,
      [generateNumericId(), encuestaIdNorm, effectiveIpsId, actividadKey]
    );
  }

  return actividadKeys.size;
}

async function upsertEncuestaActividad(config, payload, { ipsId = null } = {}) {
  const normalized = normalizeModulePayload(payload, config.aliases || {});
  const encuestaId = normalizeTextLen(normalized.encuesta_id, 36);
  const actividadKey = normalizeTextLen(normalized.actividad_key, 60);
  const effectiveIpsId = await resolveEncuestaIpsId(encuestaId, normalized.ips_id ?? ipsId);

  if (!encuestaId || !actividadKey) {
    return { status: "empty-payload", row: null };
  }

  await pool.query(
    `INSERT INTO encuesta_actividades (id, encuesta_id, ips_id, actividad_key)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       ips_id = COALESCE(VALUES(ips_id), ips_id),
       actividad_key = VALUES(actividad_key)`,
    [generateNumericId(), encuestaId, effectiveIpsId, actividadKey]
  );

  const [rows] = await pool.query(
    `SELECT * FROM encuesta_actividades
     WHERE encuesta_id = ? AND actividad_key = ?
     LIMIT 1`,
    [encuestaId, actividadKey]
  );

  return {
    status: "created",
    row: rows.length ? toModuleRow(rows[0], config) : null,
  };
}

function normalizeDateTimeForMySql(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }
    return value.toISOString().slice(0, 19).replace("T", " ");
  }

  const raw = String(value).trim();
  if (!raw) {
    return null;
  }

  // Ya viene compatible con MySQL DATETIME
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(raw)) {
    return raw.replace("T", " ");
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 19).replace("T", " ");
}

function normalizeProfesional(value) {
  const items = Array.isArray(value)
    ? value
    : (typeof value === "string" ? value.split(/[,|]/) : [value]);

  const normalized = items
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);

  return normalized.join(", ");
}

function normalizeContratoPayload(payload = {}, id = null) {
  const normalized = normalizeModulePayload(payload, MODULES.contratos.aliases || {});
  const cups = normalizeArray(payload?.cups);

  return {
    id: normalizeTextLen(id || normalized.id || randomUUID(), 36),
    ips_id: normalizeIpsId(normalized.ips_id),
    eps_id: normalizeTextLen(normalized.eps_id, 36),
    eps_nombre: normalizeTextLen(normalized.eps_nombre, 190) || "",
    fecha_creacion: normalizeDateTimeForMySql(normalized.fecha_creacion),
    cups,
  };
}

async function resolveValidEpsId(epsId) {
  if (!epsId) {
    return null;
  }

  const [rows] = await pool.query(
    `SELECT id FROM eps WHERE id = ? LIMIT 1`,
    [epsId]
  );

  return rows.length ? epsId : null;
}

function normalizeContratoCup(cup = {}, fallbackEpsId = null, fallbackEpsNombre = "", fallbackIpsId = null) {
  return {
    row_id: randomUUID(),
    ips_id: normalizeIpsId(cup.ipsId ?? cup.ips_id ?? fallbackIpsId),
    eps_id: normalizeTextLen(cup.epsId, 36) || normalizeTextLen(fallbackEpsId, 36),
    eps_nombre: normalizeTextLen(cup.epsNombre, 190) || normalizeTextLen(fallbackEpsNombre, 190) || "",
    cups_id: normalizeTextLen(cup.cupsId ?? cup.id, 36),
    cups_nombre: normalizeTextLen(cup.cupsNombre ?? cup.DescripcionCUP, 255),
    actividad_id: normalizeTextLen(cup.actividadId, 60),
    actividad_nombre: normalizeTextLen(cup.actividadNombre, 190),
    cups_profesional: normalizeTextLen(normalizeProfesional(cup.cupsProfesional ?? cup.profesional), 255),
    cups_grupo: normalizeTextLen(cup.cupsGrupo ?? cup.Grupo ?? cup.grupo, 120),
  };
}

function toContratoCupPayload(row = {}) {
  return {
    epsId: row.eps_id ?? null,
    epsNombre: row.eps_nombre ?? "",
    cupsId: row.cups_id ?? null,
    cupsNombre: row.cups_nombre ?? "",
    actividadId: row.actividad_id ?? null,
    actividadNombre: row.actividad_nombre ?? null,
    cupsProfesional: row.cups_profesional
      ? row.cups_profesional.split(",").map((it) => it.trim()).filter(Boolean)
      : [],
    cupsGrupo: row.cups_grupo ?? "",
  };
}

function normalizeAsignacionPayload(payload = {}, id = null) {
  const normalized = normalizeModulePayload(payload, MODULES.asignaciones.aliases || {});
  const legacy = payload?.datos && typeof payload.datos === "object" ? payload.datos : payload;
  const hasOwnCups = Object.prototype.hasOwnProperty.call(payload || {}, "cups")
    || Object.prototype.hasOwnProperty.call(legacy || {}, "cups")
    || Object.prototype.hasOwnProperty.call(normalized || {}, "cups");

  return {
    encuesta_id: normalizeTextLen(id || normalized.encuesta_id || legacy.idEncuesta, 36),
    ips_id: normalizeIpsId(normalized.ips_id),
    key_ref: normalizeTextLen(normalized.key_ref ?? legacy.key, 100),
    nombre_prof: normalizeTextLen(normalized.nombre_prof ?? legacy.nombreProf ?? legacy.nombrePtof, 190),
    convenio: normalizeTextLen(normalized.convenio ?? legacy.convenio, 120),
    cups: normalizeArray(legacy.cups ?? normalized.cups),
    has_cups: hasOwnCups,
  };
}

function normalizeAsignacionCup(cup = {}, fallback = {}) {
  const facturadoRaw = cup.facturado ?? cup.Facturado;
  const facturado = facturadoRaw === undefined || facturadoRaw === null || facturadoRaw === ""
    ? null
    : ([true, 1, "1", "true", "TRUE", "si", "sí", "yes"].includes(facturadoRaw) ? 1 : 0);

  return {
    row_id: randomUUID(),
    ips_id: normalizeIpsId(cup.ipsId ?? cup.ips_id ?? fallback.ips_id),
    encuesta_id: fallback.encuesta_id,
    key_ref: normalizeTextLen(cup.key ?? fallback.key_ref, 100),
    nombre_prof: normalizeTextLen(cup.nombreProf ?? cup.nombrePtof ?? fallback.nombre_prof, 190),
    convenio: normalizeTextLen(cup.convenio ?? fallback.convenio, 120),
    actividad_id: normalizeTextLen(cup.actividadId, 60),
    cups_id: normalizeTextLen(cup.cupsId ?? cup.id, 36),
    cups_nombre: normalizeTextLen(cup.cupsNombre ?? cup.DescripcionCUP, 255),
    cups_codigo: normalizeTextLen(cup.codigo, 40),
    cups_grupo: normalizeTextLen(cup.Grupo ?? cup.grupo, 120),
    cantidad: Number.isFinite(Number(cup.cantidad)) ? Number(cup.cantidad) : null,
    detalle: normalizeText(cup.detalle),
    fact_num: normalizeTextLen(cup.FactNum ?? cup.factNum ?? cup.numFactura, 80),
    fact_prof: normalizeTextLen(cup.FactProf ?? cup.factProf ?? cup.idFacturador, 36),
    facturado,
    fecha_facturacion: normalizeDateTimeForMySql(cup.fechaFacturacion ?? cup.fecha_facturacion),
  };
}

function toAsignacionCupPayload(row = {}) {
  return {
    id: row.cups_id,
    cupsId: row.cups_id,
    cupsNombre: row.cups_nombre,
    codigo: row.cups_codigo,
    Grupo: row.cups_grupo,
    cantidad: row.cantidad,
    detalle: row.detalle,
    actividadId: row.actividad_id,
    key: row.key_ref,
    nombreProf: row.nombre_prof,
    convenio: row.convenio,
    FactNum: row.fact_num ?? null,
    FactProf: row.fact_prof ?? null,
    facturado: row.facturado === 1 || row.facturado === true,
    fechaFacturacion: row.fecha_facturacion ?? null,
  };
}

async function listContratoCupsByContratoIds(contratoIds = []) {
  if (!contratoIds.length) {
    return {};
  }

  const placeholders = contratoIds.map(() => "?").join(", ");
  const [rows] = await pool.query(
    `SELECT * FROM contrato_cups WHERE contrato_id IN (${placeholders}) ORDER BY id ASC`,
    contratoIds
  );

  const grouped = {};
  rows.forEach((row) => {
    const key = String(row.contrato_id);
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(toContratoCupPayload(row));
  });

  return grouped;
}

async function listAsignacionCupsByEncuestaIds(encuestaIds = []) {
  if (!encuestaIds.length) {
    return {};
  }

  const placeholders = encuestaIds.map(() => "?").join(", ");
  const [rows] = await pool.query(
    `SELECT * FROM asignacion_cups WHERE encuesta_id IN (${placeholders}) ORDER BY id ASC`,
    encuestaIds
  );

  const grouped = {};
  rows.forEach((row) => {
    const key = String(row.encuesta_id);
    if (!grouped[key]) {
      grouped[key] = {};
    }
    grouped[key][String(row.id)] = toAsignacionCupPayload(row);
  });

  return grouped;
}

async function saveContratoCups(contratoId, cups = [], fallback = {}) {
  await pool.query("DELETE FROM contrato_cups WHERE contrato_id = ?", [contratoId]);

  const rowsRaw = cups
    .map((cup) => normalizeContratoCup(cup, fallback.eps_id, fallback.eps_nombre, fallback.ips_id))
    .filter((row) => row.cups_id && row.cups_nombre);

  // Evita errores por duplicados legacy en payload (misma dupla cups_id + actividad_id)
  const dedup = new Map();
  rowsRaw.forEach((row) => {
    const key = `${row.cups_id}::${row.actividad_id || ""}`;
    dedup.set(key, row);
  });
  const rows = Array.from(dedup.values());

  if (!rows.length) {
    return;
  }

  const values = rows.map((row) => [
    row.row_id,
    row.ips_id,
    contratoId,
    row.eps_id,
    row.eps_nombre,
    row.cups_id,
    row.cups_nombre,
    row.actividad_id,
    row.actividad_nombre,
    row.cups_profesional,
    row.cups_grupo,
  ]);

  await pool.query(
    `INSERT INTO contrato_cups
      (id, ips_id, contrato_id, eps_id, eps_nombre, cups_id, cups_nombre, actividad_id, actividad_nombre, cups_profesional, cups_grupo)
     VALUES ?
     ON DUPLICATE KEY UPDATE
       ips_id = VALUES(ips_id),
       eps_id = VALUES(eps_id),
       eps_nombre = VALUES(eps_nombre),
       cups_nombre = VALUES(cups_nombre),
       actividad_nombre = VALUES(actividad_nombre),
       cups_profesional = VALUES(cups_profesional),
       cups_grupo = VALUES(cups_grupo)`,
    [values]
  );
}

async function saveAsignacionCups(encuestaId, cups = [], fallback = {}) {
  await ensureAsignacionCupsFacturacionColumns();

  const rowsRaw = cups
    .map((cup) => normalizeAsignacionCup(cup, { ...fallback, encuesta_id: encuestaId }))
    .filter((row) => row.cups_id && row.cups_nombre);

  // Evita borrado destructivo cuando llega un PATCH parcial que no incluye cups.
  if (!fallback.has_cups && !rowsRaw.length) {
    return;
  }

  await pool.query("DELETE FROM asignacion_cups WHERE encuesta_id = ?", [encuestaId]);

  // Evita errores por duplicados legacy en payload (misma dupla cups_id + actividad_id)
  const dedup = new Map();
  rowsRaw.forEach((row) => {
    const key = `${row.cups_id}::${row.actividad_id || ""}`;
    dedup.set(key, row);
  });
  const rows = Array.from(dedup.values());

  if (!rows.length) return;

  const values = rows.map((row) => [
    row.row_id,
    row.ips_id,
    row.encuesta_id,
    row.key_ref,
    row.nombre_prof,
    row.convenio,
    row.actividad_id,
    row.cups_id,
    row.cups_nombre,
    row.cups_codigo,
    row.cups_grupo,
    row.cantidad,
    row.detalle,
    row.fact_num,
    row.fact_prof,
    row.facturado,
    row.fecha_facturacion,
  ]);

  await pool.query(
    `INSERT INTO asignacion_cups
      (id, ips_id, encuesta_id, key_ref, nombre_prof, convenio, actividad_id, cups_id, cups_nombre, cups_codigo, cups_grupo, cantidad, detalle, fact_num, fact_prof, facturado, fecha_facturacion)
     VALUES ?
     ON DUPLICATE KEY UPDATE
       ips_id = VALUES(ips_id),
       key_ref = VALUES(key_ref),
       nombre_prof = VALUES(nombre_prof),
       convenio = VALUES(convenio),
       cups_nombre = VALUES(cups_nombre),
       cups_codigo = VALUES(cups_codigo),
       cups_grupo = VALUES(cups_grupo),
       cantidad = VALUES(cantidad),
       detalle = VALUES(detalle),
       fact_num = VALUES(fact_num),
       fact_prof = VALUES(fact_prof),
       facturado = VALUES(facturado),
       fecha_facturacion = VALUES(fecha_facturacion)`,
    [values]
  );
}

async function listContratosRows(config, { limit = 100, offset = 0, ipsId = null } = {}) {
  const whereClause = ipsId ? "WHERE ips_id = ?" : "";
  const params = ipsId ? [ipsId, limit, offset] : [limit, offset];
  const [rows] = await pool.query(
    `SELECT * FROM contratos ${whereClause} ORDER BY fecha_creacion DESC LIMIT ? OFFSET ?`,
    params
  );

  const groupedCups = await listContratoCupsByContratoIds(rows.map((row) => row.id));
  return rows.map((row) => ({
    ...toModuleRow(row, config),
    cups: groupedCups[String(row.id)] || [],
  }));
}

async function findContratoById(config, id, { ipsId = null } = {}) {
  const whereClause = ipsId ? "id = ? AND ips_id = ?" : "id = ?";
  const params = ipsId ? [id, ipsId] : [id];
  const [rows] = await pool.query(
    `SELECT * FROM contratos WHERE ${whereClause} LIMIT 1`,
    params
  );
  if (!rows.length) {
    return null;
  }

  const row = toModuleRow(rows[0], config);
  const groupedCups = await listContratoCupsByContratoIds([id]);
  return {
    ...row,
    cups: groupedCups[String(id)] || [],
  };
}

async function upsertContrato(config, payload, id = null, { ipsId = null } = {}) {
  const normalized = normalizeContratoPayload(payload, id);
  if (!normalized.id || !normalized.eps_nombre) {
    return { status: "empty-payload", row: null };
  }

  if (ipsId) {
    normalized.ips_id = ipsId;
  }

  // Evita 500 por FK cuando el id de EPS legado ya no existe en tabla eps.
  normalized.eps_id = await resolveValidEpsId(normalized.eps_id);

  await pool.query(
    `INSERT INTO contratos (id, ips_id, eps_id, eps_nombre, fecha_creacion)
     VALUES (?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
     ON DUPLICATE KEY UPDATE
       ips_id = VALUES(ips_id),
       eps_id = VALUES(eps_id),
       eps_nombre = VALUES(eps_nombre),
       fecha_creacion = COALESCE(VALUES(fecha_creacion), fecha_creacion)`,
    [normalized.id, normalized.ips_id, normalized.eps_id, normalized.eps_nombre, normalized.fecha_creacion]
  );

  await saveContratoCups(normalized.id, normalized.cups, normalized);

  return { status: "updated", row: await findContratoById(config, normalized.id, { ipsId }) };
}

async function listAsignacionesRows(config, { limit = 100, offset = 0, ipsId = null } = {}) {
  const whereClause = ipsId ? "WHERE ips_id = ?" : "";
  const params = ipsId ? [ipsId, limit, offset] : [limit, offset];
  const [rows] = await pool.query(
    `SELECT * FROM asignaciones ${whereClause} ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
    params
  );

  const groupedCups = await listAsignacionCupsByEncuestaIds(rows.map((row) => row.encuesta_id));
  return rows.map((row) => ({
    ...toModuleRow(row, config),
    key: row.key_ref,
    nombrePtof: row.nombre_prof,
    cups: groupedCups[String(row.encuesta_id)] || {},
  }));
}

async function findAsignacionById(config, id, { ipsId = null } = {}) {
  const whereClause = ipsId ? "encuesta_id = ? AND ips_id = ?" : "encuesta_id = ?";
  const params = ipsId ? [id, ipsId] : [id];
  const [rows] = await pool.query(
    `SELECT * FROM asignaciones WHERE ${whereClause} LIMIT 1`,
    params
  );
  if (!rows.length) {
    return null;
  }

  const row = rows[0];
  const groupedCups = await listAsignacionCupsByEncuestaIds([id]);
  return {
    ...toModuleRow(row, config),
    key: row.key_ref,
    nombrePtof: row.nombre_prof,
    cups: groupedCups[String(id)] || {},
  };
}

async function upsertAsignacion(config, payload, id = null, { ipsId = null } = {}) {
  const normalized = normalizeAsignacionPayload(payload, id);
  if (!normalized.encuesta_id) {
    return { status: "empty-payload", row: null };
  }

  if (ipsId) {
    normalized.ips_id = ipsId;
  }

  await pool.query(
    `INSERT INTO asignaciones (encuesta_id, ips_id, key_ref, nombre_prof, convenio)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       ips_id = VALUES(ips_id),
       key_ref = VALUES(key_ref),
       nombre_prof = VALUES(nombre_prof),
       convenio = VALUES(convenio)`,
    [normalized.encuesta_id, normalized.ips_id, normalized.key_ref, normalized.nombre_prof, normalized.convenio]
  );

  await saveAsignacionCups(normalized.encuesta_id, normalized.cups, normalized);

  return { status: "updated", row: await findAsignacionById(config, normalized.encuesta_id, { ipsId }) };
}

export async function listModuleRows(config, { limit = 100, offset = 0, ipsId = null, filters = {} } = {}) {
  if (config.moduleName === "contratos") {
    return listContratosRows(config, { limit, offset, ipsId });
  }

  if (config.moduleName === "asignaciones") {
    return listAsignacionesRows(config, { limit, offset, ipsId });
  }

  if (config.moduleName === "encuesta_actividades") {
    const encuestaId = normalizeTextLen(filters?.encuestaId ?? filters?.encuesta_id, 36);
    const whereParts = [];
    const params = [];

    if (encuestaId) {
      whereParts.push("encuesta_id = ?");
      params.push(encuestaId);
    }

    if (ipsId) {
      whereParts.push("(ips_id = ? OR ips_id IS NULL OR ips_id = '')");
      params.push(ipsId);
    }

    const whereClause = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
    params.push(limit, offset);
    const [rows] = await pool.query(
      `SELECT * FROM ${config.table} ${whereClause} ORDER BY ${config.pk} DESC LIMIT ? OFFSET ?`,
      params
    );
    return rows.map((row) => toModuleRow(row, config));
  }

  if (config.moduleName === "encuestas") {
    const whereParts = [];
    const params = [];

    if (hasIpsColumn(config) && ipsId) {
      whereParts.push("ips_id = ?");
      params.push(ipsId);
    }

    const exactTextFilters = [
      ["id", ["id"]],
      ["tipodoc", ["tipodoc"]],
      ["numdoc", ["numdoc"]],
      ["id_encuestador", ["idEncuestador", "id_encuestador"]],
      ["id_medico_atiende", ["idMedicoAtiende", "id_medico_atiende"]],
      ["id_enfermero_atiende", ["idEnfermeroAtiende", "id_enfermero_atiende"]],
      ["id_psicologo_atiende", ["idPsicologoAtiende", "id_psicologo_atiende"]],
      ["id_tsocial_atiende", ["idTsocialAtiende", "id_tsocial_atiende"]],
      ["id_nutricionista_atiende", ["idNutricionistaAtiende", "idNutriAtiende", "idNutricionista", "idNutricionAtiende", "id_nutricionista_atiende"]],
      ["convenio", ["convenio"]],
    ];

    exactTextFilters.forEach(([columnName, aliases]) => {
      const filterValue = normalizeTextLen(getFirstFilterValue(filters, aliases), 120);
      if (!filterValue) {
        return;
      }

      whereParts.push(`${columnName} = ?`);
      params.push(filterValue);
    });

    const booleanFilters = [
      ["status_gest_aux", ["status_gest_aux"]],
      ["status_gest_medica", ["status_gest_medica"]],
      ["status_gest_enfermera", ["status_gest_enfermera"]],
      ["status_gest_psicologo", ["status_gest_psicologo"]],
      ["status_gest_tsocial", ["status_gest_tsocial"]],
      ["status_gest_nutricionista", ["status_gest_nutricionista", "status_gest_nutri"]],
      ["status_visita", ["status_visita"]],
      ["status_caracterizacion", ["status_caracterizacion"]],
      ["status_facturacion", ["status_facturacion"]],
    ];

    booleanFilters.forEach(([columnName, aliases]) => {
      const filterValue = normalizeBooleanFilter(getFirstFilterValue(filters, aliases));
      if (filterValue === null) {
        return;
      }

      whereParts.push(`${columnName} = ?`);
      params.push(filterValue);
    });

    const whereClause = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
    params.push(limit, offset);
    const [rows] = await pool.query(
      `SELECT * FROM ${config.table} ${whereClause} ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
      params
    );
    return rows.map((row) => toModuleRow(row, config));
  }

  if (config.moduleName === "caracterizacion") {
    const whereParts = [];
    const params = [];

    if (hasIpsColumn(config) && ipsId) {
      whereParts.push("ips_id = ?");
      params.push(ipsId);
    }

    const convenio = normalizeTextLen(getFirstFilterValue(filters, ["convenio"]), 120);
    if (convenio) {
      whereParts.push("convenio = ?");
      params.push(convenio);
    }

    const encuestaId = normalizeTextLen(getFirstFilterValue(filters, ["encuestaId", "encuesta_id"]), 36);
    if (encuestaId) {
      whereParts.push("encuesta_id = ?");
      params.push(encuestaId);
    }

    const whereClause = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
    params.push(limit, offset);
    const [rows] = await pool.query(
      `SELECT * FROM ${config.table} ${whereClause} ORDER BY ${config.pk} DESC LIMIT ? OFFSET ?`,
      params
    );
    return rows.map((row) => toModuleRow(row, config));
  }

  const whereClause = hasIpsColumn(config) && ipsId ? "WHERE ips_id = ?" : "";
  const params = whereClause ? [ipsId, limit, offset] : [limit, offset];
  const [rows] = await pool.query(
    `SELECT * FROM ${config.table} ${whereClause} ORDER BY ${config.pk} DESC LIMIT ? OFFSET ?`,
    params
  );
  return rows.map((row) => toModuleRow(row, config));
}

export async function findModuleRowById(config, id, { ipsId = null } = {}) {
  if (config.moduleName === "contratos") {
    return findContratoById(config, id, { ipsId });
  }

  if (config.moduleName === "asignaciones") {
    return findAsignacionById(config, id, { ipsId });
  }

  const whereClause = hasIpsColumn(config) && ipsId
    ? `${config.pk} = ? AND ips_id = ?`
    : `${config.pk} = ?`;
  const params = hasIpsColumn(config) && ipsId ? [id, ipsId] : [id];

  const [rows] = await pool.query(
    `SELECT * FROM ${config.table} WHERE ${whereClause} LIMIT 1`,
    params
  );
  return rows.length ? toModuleRow(rows[0], config) : null;
}

export async function createModuleRow(config, payload, { ipsId = null } = {}) {
  if (config.moduleName === "contratos") {
    return upsertContrato(config, payload, payload?.id || null, { ipsId });
  }

  if (config.moduleName === "asignaciones") {
    return upsertAsignacion(config, payload, payload?.encuestaId ?? payload?.encuesta_id ?? null, { ipsId });
  }

  if (config.moduleName === "encuesta_actividades") {
    return upsertEncuestaActividad(config, payload, { ipsId });
  }

  const normalized = normalizeModulePayload(payload, config.aliases);
  await normalizeIpsCodField(config, normalized);
  const allowed = await resolveAllowedColumns(config, ["created_at", "updated_at", "fecha_creacion"]);
  const insertData = {};

  allowed.forEach((column) => {
    if (normalized[column] !== undefined) {
      insertData[column] = prepareModuleValue(
        column,
        normalized[column],
        config.jsonColumns || [],
        config.maxLengths || {}
      );
    }
  });

  if (hasIpsColumn(config) && ipsId) {
    insertData.ips_id = ipsId;
  }

  if (config.pk === "id" && !insertData.id) {
    const pkIsAutoIncrement = await isPkAutoIncrement(config.table, config.pk);
    if (!pkIsAutoIncrement) {
      insertData.id = randomUUID();
    } else {
      const pkIsNumeric = await isPkNumeric(config.table, config.pk);
      if (pkIsNumeric) {
        // Workaround para motores/tabla con contador autoincrement roto.
        insertData.id = generateNumericId();
      }
    }
  }

  if (!Object.keys(insertData).length) {
    return { status: "empty-payload", row: null };
  }

  const cols = Object.keys(insertData);
  const placeholders = cols.map(() => "?").join(", ");
  const values = cols.map((column) => insertData[column]);

  // INSERT IGNORE: silently skip duplicates (e.g. encuesta_actividades)
  if (config.onConflict === "IGNORE") {
    await pool.query(
      `INSERT IGNORE INTO ${config.table} (${cols.join(", ")}) VALUES (${placeholders})`,
      values
    );
    return { status: "created", row: await findModuleRowById(config, insertData[config.pk], { ipsId }) };
  }

  // INSERT ... ON DUPLICATE KEY UPDATE: upsert based on a secondary unique key (e.g. caracterizacion.encuesta_id)
  if (config.onConflict === "UPDATE_BY_UNIQUE" && config.uniqueKey) {
    const updateCols = cols.filter((col) => col !== config.pk && col !== config.uniqueKey);
    if (updateCols.length) {
      const updateClause = updateCols.map((col) => `${col} = VALUES(${col})`).join(", ");
      await pool.query(
        `INSERT INTO ${config.table} (${cols.join(", ")}) VALUES (${placeholders})
         ON DUPLICATE KEY UPDATE ${updateClause}`,
        values
      );
    } else {
      await pool.query(
        `INSERT IGNORE INTO ${config.table} (${cols.join(", ")}) VALUES (${placeholders})`,
        values
      );
    }

    // Retrieve the row using uniqueKey since the pk might be a new UUID that wasn't actually inserted
    const ukVal = insertData[config.uniqueKey];
    if (ukVal !== undefined) {
      const uniqueWhere = hasIpsColumn(config) && ipsId
        ? `${config.uniqueKey} = ? AND ips_id = ?`
        : `${config.uniqueKey} = ?`;
      const uniqueParams = hasIpsColumn(config) && ipsId ? [ukVal, ipsId] : [ukVal];
      const [rows] = await pool.query(
        `SELECT * FROM ${config.table} WHERE ${uniqueWhere} LIMIT 1`,
        uniqueParams
      );
      const row = rows.length ? toModuleRow(rows[0], config) : null;
      return { status: "created", row };
    }

    return { status: "created", row: await findModuleRowById(config, insertData[config.pk], { ipsId }) };
  }

  await pool.query(
    `INSERT INTO ${config.table} (${cols.join(", ")}) VALUES (${placeholders})`,
    values
  );

  return { status: "created", row: await findModuleRowById(config, insertData[config.pk], { ipsId }) };
}

export async function updateModuleRow(config, id, payload, { replace = false, ipsId = null } = {}) {
  if (config.moduleName === "contratos") {
    return upsertContrato(config, { ...payload, id }, id, { ipsId });
  }

  if (config.moduleName === "asignaciones") {
    return upsertAsignacion(config, { ...payload, encuestaId: id }, id, { ipsId });
  }

  const normalized = normalizeModulePayload(payload, config.aliases);
  await normalizeIpsCodField(config, normalized);
  const excluded = replace
    ? ["created_at", "updated_at", "fecha_creacion"]
    : [config.pk, "created_at", "updated_at", "fecha_creacion"];
  const allowed = await resolveAllowedColumns(config, excluded);

  const setCols = [];
  const values = [];

  allowed.forEach((column) => {
    if (column === config.pk) {
      return;
    }

    if (normalized[column] !== undefined) {
      setCols.push(`${column} = ?`);
      values.push(
        prepareModuleValue(
          column,
          normalized[column],
          config.jsonColumns || [],
          config.maxLengths || {}
        )
      );
    }
  });

  if (hasIpsColumn(config) && ipsId && normalized.ips_id === undefined) {
    setCols.push("ips_id = ?");
    values.push(ipsId);
  }

  if (!setCols.length) {
    return { status: "empty-payload", row: null };
  }

  const whereClause = hasIpsColumn(config) && ipsId
    ? `${config.pk} = ? AND ips_id = ?`
    : `${config.pk} = ?`;
  values.push(id);
  if (hasIpsColumn(config) && ipsId) {
    values.push(ipsId);
  }

  const [result] = await pool.query(
    `UPDATE ${config.table} SET ${setCols.join(", ")} WHERE ${whereClause}`,
    values
  );

  if (!result.affectedRows && replace) {
    return createModuleRow(config, { ...payload, [config.pk]: id }, { ipsId });
  }

  if (!result.affectedRows) {
    return { status: "not-found", row: null };
  }

  return { status: "updated", row: await findModuleRowById(config, id, { ipsId }) };
}

export async function deleteModuleRow(config, id, { ipsId = null, actor = null } = {}) {
  if (config.moduleName === "contratos") {
    const snapshot = await findContratoById(config, id, { ipsId });
    await archiveDeletedModuleRow(config.moduleName, id, snapshot, { ipsId, actor });

    const whereClause = ipsId ? "id = ? AND ips_id = ?" : "id = ?";
    const params = ipsId ? [id, ipsId] : [id];
    const [result] = await pool.query(`DELETE FROM contratos WHERE ${whereClause}`, params);
    return result.affectedRows;
  }

  if (config.moduleName === "asignaciones") {
    const snapshot = await findAsignacionById(config, id, { ipsId });
    await archiveDeletedModuleRow(config.moduleName, id, snapshot, { ipsId, actor });
    await pool.query("DELETE FROM asignacion_cups WHERE encuesta_id = ?", [id]);

    const whereClause = ipsId ? "encuesta_id = ? AND ips_id = ?" : "encuesta_id = ?";
    const params = ipsId ? [id, ipsId] : [id];
    const [result] = await pool.query(`DELETE FROM asignaciones WHERE ${whereClause}`, params);
    return result.affectedRows;
  }

  const snapshot = await findModuleRowById(config, id, { ipsId });
  await archiveDeletedModuleRow(config.moduleName, id, snapshot, { ipsId, actor });

  const whereClause = hasIpsColumn(config) && ipsId
    ? `${config.pk} = ? AND ips_id = ?`
    : `${config.pk} = ?`;
  const params = hasIpsColumn(config) && ipsId ? [id, ipsId] : [id];

  const [result] = await pool.query(
    `DELETE FROM ${config.table} WHERE ${whereClause}`,
    params
  );
  return result.affectedRows;
}

export async function findCaracterizacionByEncuestaId(encuestaId, { ipsId = null } = {}) {
  const config = MODULES.caracterizacion;
  const whereClause = ipsId ? "encuesta_id = ? AND ips_id = ?" : "encuesta_id = ?";
  const params = ipsId ? [encuestaId, ipsId] : [encuestaId];
  const [rows] = await pool.query(
    `SELECT * FROM caracterizacion WHERE ${whereClause} LIMIT 1`,
    params
  );
  return rows.length ? toModuleRow(rows[0], config) : null;
}