import { randomUUID } from "node:crypto";
import { pool } from "../utils/database.js";

let tablesEnsured = false;

export async function ensureEpsBdTables() {
  if (tablesEnsured) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS eps_bd (
      id VARCHAR(36) PRIMARY KEY,
      nombre VARCHAR(190) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_eps_bd_nombre (nombre)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS eps_bd_registros (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      eps_bd_id VARCHAR(36) NOT NULL,
      tipo_documento VARCHAR(20) NOT NULL,
      numdoc VARCHAR(40) NOT NULL,
      nombre1 VARCHAR(120) NOT NULL,
      apellido1 VARCHAR(120) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_eps_bd_registros_eps (eps_bd_id),
      INDEX idx_eps_bd_registros_numdoc (numdoc),
      CONSTRAINT fk_eps_bd_registros_eps
        FOREIGN KEY (eps_bd_id) REFERENCES eps_bd(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  tablesEnsured = true;
}

function toText(value, maxLen = null) {
  if (value === null || value === undefined) return "";
  let out = String(value).trim();
  if (maxLen && out.length > maxLen) {
    out = out.slice(0, maxLen);
  }
  return out;
}

export async function listEpsBd() {
  await ensureEpsBdTables();
  const [rows] = await pool.query(`
    SELECT
      e.id,
      e.nombre,
      e.created_at AS createdAt,
      e.updated_at AS updatedAt,
      COUNT(r.id) AS totalRegistros
    FROM eps_bd e
    LEFT JOIN eps_bd_registros r ON r.eps_bd_id = e.id
    GROUP BY e.id, e.nombre, e.created_at, e.updated_at
    ORDER BY e.nombre ASC
  `);
  return rows.map((row) => ({
    id: row.id,
    nombre: row.nombre,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    totalRegistros: Number(row.totalRegistros || 0),
  }));
}

export async function findEpsBdById(id) {
  await ensureEpsBdTables();
  const [rows] = await pool.query(
    `SELECT id, nombre, created_at AS createdAt, updated_at AS updatedAt
       FROM eps_bd
      WHERE id = ?
      LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

export async function createEpsBd(nombre) {
  await ensureEpsBdTables();
  const id = randomUUID();
  await pool.query(
    `INSERT INTO eps_bd (id, nombre) VALUES (?, ?)`,
    [id, nombre]
  );
  return findEpsBdById(id);
}

export async function updateEpsBd(id, nombre) {
  await ensureEpsBdTables();
  await pool.query(
    `UPDATE eps_bd SET nombre = ? WHERE id = ?`,
    [nombre, id]
  );
  return findEpsBdById(id);
}

export async function deleteEpsBd(id) {
  await ensureEpsBdTables();

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [countRows] = await connection.query(
      `SELECT COUNT(*) AS total FROM eps_bd_registros WHERE eps_bd_id = ?`,
      [id]
    );
    const registrosEliminados = Number(countRows[0]?.total || 0);

    await connection.query(`DELETE FROM eps_bd_registros WHERE eps_bd_id = ?`, [id]);

    const [result] = await connection.query(`DELETE FROM eps_bd WHERE id = ?`, [id]);
    if (Number(result.affectedRows || 0) === 0) {
      await connection.rollback();
      return { deleted: false, registrosEliminados: 0 };
    }

    await connection.commit();
    return { deleted: true, registrosEliminados };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function countRegistrosByEpsBdId(epsBdId) {
  await ensureEpsBdTables();
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total FROM eps_bd_registros WHERE eps_bd_id = ?`,
    [epsBdId]
  );
  return Number(rows[0]?.total || 0);
}

export async function listRegistrosByEpsBdId(epsBdId, { limit = 50, offset = 0 } = {}) {
  await ensureEpsBdTables();
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 5000);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  const [rows] = await pool.query(
    `SELECT
       id,
       eps_bd_id AS epsBdId,
       tipo_documento AS tipoDocumento,
       numdoc,
       nombre1,
       apellido1,
       created_at AS createdAt
     FROM eps_bd_registros
     WHERE eps_bd_id = ?
     ORDER BY id ASC
     LIMIT ? OFFSET ?`,
    [epsBdId, safeLimit, safeOffset]
  );
  return rows;
}

export async function listAllRegistrosByEpsBdId(epsBdId) {
  await ensureEpsBdTables();
  const [rows] = await pool.query(
    `SELECT
       tipo_documento AS tipoDocumento,
       numdoc,
       nombre1,
       apellido1
     FROM eps_bd_registros
     WHERE eps_bd_id = ?
     ORDER BY id ASC`,
    [epsBdId]
  );
  return rows;
}

export async function listIndiceDocumentosEpsBd() {
  await ensureEpsBdTables();
  const [rows] = await pool.query(
    `SELECT
       r.tipo_documento AS tipoDocumento,
       r.numdoc,
       r.nombre1,
       r.apellido1,
       r.eps_bd_id AS epsBdId,
       e.nombre AS epsNombre
     FROM eps_bd_registros r
     INNER JOIN eps_bd e ON e.id = r.eps_bd_id
     ORDER BY r.id ASC`
  );
  return rows;
}

export async function clearRegistrosByEpsBdId(epsBdId) {
  await ensureEpsBdTables();
  const [result] = await pool.query(
    `DELETE FROM eps_bd_registros WHERE eps_bd_id = ?`,
    [epsBdId]
  );
  return Number(result.affectedRows || 0);
}

export async function insertRegistrosBulk(epsBdId, registros = []) {
  await ensureEpsBdTables();
  if (!registros.length) return 0;

  const CHUNK_SIZE = 500;
  let insertados = 0;

  for (let i = 0; i < registros.length; i += CHUNK_SIZE) {
    const chunk = registros.slice(i, i + CHUNK_SIZE);
    const values = [];
    const params = [];

    chunk.forEach((row) => {
      values.push("(?, ?, ?, ?, ?)");
      params.push(
        epsBdId,
        toText(row.tipoDocumento, 20),
        toText(row.numdoc, 40),
        toText(row.nombre1, 120),
        toText(row.apellido1, 120)
      );
    });

    const [result] = await pool.query(
      `INSERT INTO eps_bd_registros (eps_bd_id, tipo_documento, numdoc, nombre1, apellido1)
       VALUES ${values.join(", ")}`,
      params
    );
    insertados += Number(result.affectedRows || 0);
  }

  return insertados;
}
