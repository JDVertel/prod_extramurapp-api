import { randomUUID } from "node:crypto";
import { pool } from "../utils/database.js";

function toText(value) {
  if (value === null || value === undefined) return null;
  const out = String(value).trim();
  return out || null;
}

function toTextLen(value, maxLen) {
  const out = toText(value);
  if (!out) return null;
  return out.length > maxLen ? out.slice(0, maxLen) : out;
}

function toDateTime(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(raw)) {
    return raw.replace("T", " ");
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 19).replace("T", " ");
}

function normalizeProfesional(value) {
  const items = Array.isArray(value) ? value : [value];
  return items
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

function normalizeCup(cup = {}, fallback = {}) {
  return {
    id: randomUUID(),
    eps_id: toTextLen(cup.epsId ?? fallback.eps_id, 36),
    eps_nombre: toTextLen(cup.epsNombre ?? fallback.eps_nombre, 190) || "",
    ips_id: toTextLen(cup.ipsId ?? cup.ips_id ?? fallback.ips_id, 36),
    cups_id: toTextLen(cup.cupsId ?? cup.id, 36),
    cups_nombre: toTextLen(cup.cupsNombre ?? cup.DescripcionCUP, 255),
    actividad_id: toTextLen(cup.actividadId, 60),
    actividad_nombre: toTextLen(cup.actividadNombre, 190),
    cups_profesional: toTextLen(normalizeProfesional(cup.cupsProfesional ?? cup.profesional), 255),
    cups_grupo: toTextLen(cup.cupsGrupo ?? cup.Grupo ?? cup.grupo, 120),
  };
}

function mapCupRow(row = {}) {
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

function mapContratoRow(row = {}, cups = []) {
  return {
    id: row.id,
    epsId: row.eps_id ?? null,
    epsNombre: row.eps_nombre ?? "",
    fechaCreacion: row.fecha_creacion ?? null,
    cups,
  };
}

async function resolveValidEpsId(epsId) {
  if (!epsId) return null;
  const [rows] = await pool.query("SELECT id FROM eps WHERE id = ? LIMIT 1", [epsId]);
  return rows.length ? epsId : null;
}

function normalizePayload(payload = {}, id = null) {
  const cupsRaw = Array.isArray(payload.cups)
    ? payload.cups
    : (payload.cups && typeof payload.cups === "object" ? Object.values(payload.cups) : []);

  const base = {
    id: toTextLen(id || payload.id || randomUUID(), 36),
    eps_id: toTextLen(payload.epsId ?? payload.eps_id, 36),
    eps_nombre: toTextLen(payload.epsNombre ?? payload.eps_nombre, 190) || "",
    ips_id: toTextLen(payload.ipsId ?? payload.ips_id, 36),
    fecha_creacion: toDateTime(payload.fechaCreacion ?? payload.fecha_creacion),
  };

  const dedup = new Map();
  cupsRaw.forEach((cup) => {
    const normalized = normalizeCup(cup, base);
    if (!normalized.cups_id || !normalized.cups_nombre) return;
    const key = `${normalized.cups_id}::${normalized.actividad_id || ""}`;
    dedup.set(key, normalized);
  });

  return {
    ...base,
    cups: Array.from(dedup.values()),
  };
}

export async function listContratos({ limit = 100, offset = 0, ipsId = null } = {}) {
  const whereClause = ipsId ? "WHERE ips_id = ?" : "";
  const params = ipsId ? [ipsId, limit, offset] : [limit, offset];
  const [rows] = await pool.query(
    `SELECT id, eps_id, eps_nombre, ips_id, fecha_creacion FROM contratos ${whereClause} ORDER BY fecha_creacion DESC LIMIT ? OFFSET ?`,
    params
  );

  if (!rows.length) return [];

  const ids = rows.map((r) => r.id);
  const placeholders = ids.map(() => "?").join(",");
  const [cupsRows] = await pool.query(
    `SELECT * FROM contrato_cups WHERE contrato_id IN (${placeholders}) ORDER BY created_at ASC`,
    ids
  );

  const grouped = {};
  cupsRows.forEach((row) => {
    const key = String(row.contrato_id);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(mapCupRow(row));
  });

  return rows.map((row) => mapContratoRow(row, grouped[String(row.id)] || []));
}

export async function findContratoById(id, { ipsId = null } = {}) {
  const ipsClause = ipsId ? " AND ips_id = ?" : "";
  const params = ipsId ? [id, ipsId] : [id];
  const [rows] = await pool.query(
    `SELECT id, eps_id, eps_nombre, ips_id, fecha_creacion FROM contratos WHERE id = ?${ipsClause} LIMIT 1`,
    params
  );
  if (!rows.length) return null;

  const [cupsRows] = await pool.query(
    "SELECT * FROM contrato_cups WHERE contrato_id = ? ORDER BY created_at ASC",
    [id]
  );

  return mapContratoRow(rows[0], cupsRows.map(mapCupRow));
}

export async function createContrato(payload = {}, { ipsId = null } = {}) {
  const normalized = normalizePayload(payload);
  normalized.eps_id = await resolveValidEpsId(normalized.eps_id);
  const effectiveIpsId = ipsId || normalized.ips_id || null;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `INSERT INTO contratos (id, eps_id, eps_nombre, ips_id, fecha_creacion)
       VALUES (?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))`,
      [normalized.id, normalized.eps_id, normalized.eps_nombre, effectiveIpsId, normalized.fecha_creacion]
    );

    if (normalized.cups.length) {
      const values = normalized.cups.map((cup) => [
        cup.id,
        normalized.id,
        cup.eps_id,
        cup.eps_nombre,
        effectiveIpsId,
        cup.cups_id,
        cup.cups_nombre,
        cup.actividad_id,
        cup.actividad_nombre,
        cup.cups_profesional,
        cup.cups_grupo,
      ]);

      await conn.query(
        `INSERT INTO contrato_cups
          (id, contrato_id, eps_id, eps_nombre, ips_id, cups_id, cups_nombre, actividad_id, actividad_nombre, cups_profesional, cups_grupo)
         VALUES ?`,
        [values]
      );
    }

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  return findContratoById(normalized.id, { ipsId: effectiveIpsId });
}

export async function replaceContrato(id, payload = {}, { ipsId = null } = {}) {
  const normalized = normalizePayload(payload, id);
  normalized.eps_id = await resolveValidEpsId(normalized.eps_id);
  const effectiveIpsId = ipsId || normalized.ips_id || null;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `INSERT INTO contratos (id, eps_id, eps_nombre, ips_id, fecha_creacion)
       VALUES (?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
       ON DUPLICATE KEY UPDATE
         eps_id = VALUES(eps_id),
         eps_nombre = VALUES(eps_nombre),
         ips_id = COALESCE(VALUES(ips_id), ips_id),
         fecha_creacion = COALESCE(VALUES(fecha_creacion), fecha_creacion)`,
      [normalized.id, normalized.eps_id, normalized.eps_nombre, effectiveIpsId, normalized.fecha_creacion]
    );

    await conn.query("DELETE FROM contrato_cups WHERE contrato_id = ?", [id]);

    if (normalized.cups.length) {
      const values = normalized.cups.map((cup) => [
        cup.id,
        id,
        cup.eps_id,
        cup.eps_nombre,
        effectiveIpsId,
        cup.cups_id,
        cup.cups_nombre,
        cup.actividad_id,
        cup.actividad_nombre,
        cup.cups_profesional,
        cup.cups_grupo,
      ]);

      await conn.query(
        `INSERT INTO contrato_cups
          (id, contrato_id, eps_id, eps_nombre, ips_id, cups_id, cups_nombre, actividad_id, actividad_nombre, cups_profesional, cups_grupo)
         VALUES ?`,
        [values]
      );
    }

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  return findContratoById(id, { ipsId: effectiveIpsId });
}

export async function deleteContrato(id, { ipsId = null } = {}) {
  const ipsClause = ipsId ? " AND ips_id = ?" : "";
  const params = ipsId ? [id, ipsId] : [id];
  const [result] = await pool.query(`DELETE FROM contratos WHERE id = ?${ipsClause}`, params);
  return result.affectedRows;
}
