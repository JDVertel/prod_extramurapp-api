import { randomUUID } from "node:crypto";
import { MODULES, normalizeModulePayload, prepareModuleValue } from "../models/module.model.js";
import { pool } from "../utils/database.js";
import { AppError, ensure } from "../utils/app-error.js";

function normalizeIpsId(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function normalizeTextLen(value, maxLen) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return null;
  }

  return normalized.length > maxLen ? normalized.slice(0, maxLen) : normalized;
}

function resolveActorIpsId(actor) {
  return normalizeIpsId(actor?.ipsId ?? actor?.ips_id ?? actor?.ips);
}

function shouldRestrictByActorIps(actor) {
  return actor?.cargo !== "superusuario";
}

function resolveDeletedBy(actor = null) {
  return normalizeTextLen(
    actor?.id ?? actor?.uid ?? actor?.documento ?? actor?.numdoc ?? actor?.email,
    120
  );
}

async function ensureDeletedRecordsTable(conn) {
  await conn.query(`
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
}

async function archiveDeletedRecord(conn, moduleName, recordId, payload, { ipsId = null, actor = null } = {}) {
  if (!payload) {
    return;
  }

  await ensureDeletedRecordsTable(conn);

  await conn.query(
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

async function findEncuestaForUpdate(conn, encuestaId, actor = null) {
  const restrictByIps = shouldRestrictByActorIps(actor);
  const actorIpsId = resolveActorIpsId(actor);

  if (restrictByIps) {
    ensure(actorIpsId, "El usuario autenticado no tiene IPS asociada", 400);
  }

  const whereClause = restrictByIps ? "id = ? AND ips_id = ?" : "id = ?";
  const params = restrictByIps ? [encuestaId, actorIpsId] : [encuestaId];
  const [rows] = await conn.query(
    `SELECT * FROM encuestas WHERE ${whereClause} LIMIT 1 FOR UPDATE`,
    params
  );

  if (!rows.length) {
    throw new AppError("Encuesta no encontrada", 404);
  }

  return rows[0];
}

function buildCaracterizacionInsertData(payload, encuestaRow, actor = null) {
  const config = MODULES.caracterizacion;
  const normalized = normalizeModulePayload(payload || {}, config.aliases || {});
  const insertData = {};

  config.columns.forEach((column) => {
    if (column === "created_at") {
      return;
    }

    if (normalized[column] !== undefined) {
      insertData[column] = prepareModuleValue(
        column,
        normalized[column],
        config.jsonColumns || [],
        config.maxLengths || {}
      );
    }
  });

  insertData.id = insertData.id || randomUUID();
  insertData.encuesta_id = normalizeTextLen(
    normalized.encuesta_id ?? payload?.encuestaId ?? payload?.idEncuesta ?? encuestaRow?.id,
    36
  );
  insertData.ips_id = normalizeIpsId(insertData.ips_id ?? encuestaRow?.ips_id ?? resolveActorIpsId(actor));
  insertData.convenio = insertData.convenio ?? encuestaRow?.convenio ?? null;

  return insertData;
}

async function upsertCaracterizacion(conn, payload, encuestaRow, actor = null) {
  const insertData = buildCaracterizacionInsertData(payload, encuestaRow, actor);
  ensure(insertData.encuesta_id, "idEncuesta es obligatorio", 400);

  const cols = Object.keys(insertData);
  ensure(cols.length > 0, "Payload de caracterizacion vacio", 400);

  const placeholders = cols.map(() => "?").join(", ");
  const values = cols.map((column) => insertData[column]);
  const updateCols = cols.filter((column) => column !== "id" && column !== "encuesta_id");
  const updateClause = updateCols
    .map((column) => `${column} = VALUES(${column})`)
    .join(", ");

  await conn.query(
    `INSERT INTO caracterizacion (${cols.join(", ")}) VALUES (${placeholders})
     ON DUPLICATE KEY UPDATE ${updateClause}`,
    values
  );
}

export async function saveCaracterizacionAndMarkEncuesta(payload, actor = null) {
  const encuestaId = normalizeTextLen(payload?.encuestaId ?? payload?.idEncuesta ?? payload?.encuesta_id, 36);
  ensure(encuestaId, "idEncuesta es obligatorio", 400);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const encuestaRow = await findEncuestaForUpdate(conn, encuestaId, actor);
    await upsertCaracterizacion(conn, payload, encuestaRow, actor);

    await conn.query(
      "UPDATE encuestas SET status_caracterizacion = 1 WHERE id = ?",
      [encuestaId]
    );

    await conn.commit();
    return { encuestaId, status_caracterizacion: true };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function returnEncuestaToAuxiliar(encuestaId, actor = null) {
  const encuestaIdNorm = normalizeTextLen(encuestaId, 36);
  ensure(encuestaIdNorm, "encuestaId es obligatorio", 400);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const encuestaRow = await findEncuestaForUpdate(conn, encuestaIdNorm, actor);
    const effectiveIpsId = normalizeIpsId(encuestaRow?.ips_id ?? resolveActorIpsId(actor));

    const [asignacionRows] = await conn.query(
      "SELECT * FROM asignaciones WHERE encuesta_id = ? LIMIT 1",
      [encuestaIdNorm]
    );
    const [cupRows] = await conn.query(
      "SELECT * FROM asignacion_cups WHERE encuesta_id = ? ORDER BY id ASC",
      [encuestaIdNorm]
    );
    const [actividadRows] = await conn.query(
      "SELECT * FROM encuesta_actividades WHERE encuesta_id = ? ORDER BY id ASC",
      [encuestaIdNorm]
    );

    const asignacionSnapshot = asignacionRows.length
      ? { ...asignacionRows[0], cups: cupRows }
      : (cupRows.length ? { encuesta_id: encuestaIdNorm, ips_id: effectiveIpsId, cups: cupRows } : null);

    await archiveDeletedRecord(conn, "asignaciones", encuestaIdNorm, asignacionSnapshot, {
      ipsId: effectiveIpsId,
      actor,
    });

    await archiveDeletedRecord(conn, "encuesta_actividades", encuestaIdNorm, actividadRows, {
      ipsId: effectiveIpsId,
      actor,
    });

    await conn.query("DELETE FROM asignacion_cups WHERE encuesta_id = ?", [encuestaIdNorm]);
    await conn.query("DELETE FROM asignaciones WHERE encuesta_id = ?", [encuestaIdNorm]);
    await conn.query("DELETE FROM encuesta_actividades WHERE encuesta_id = ?", [encuestaIdNorm]);
    await conn.query(
      "UPDATE encuestas SET status_gest_aux = 0 WHERE id = ?",
      [encuestaIdNorm]
    );

    await conn.commit();
    return { encuestaId: encuestaIdNorm, status_gest_aux: 0 };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}