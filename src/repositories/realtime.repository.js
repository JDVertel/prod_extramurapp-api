import { pool } from "../utils/database.js";

export function parseMysqlJson(value) {
  return typeof value === "string" ? JSON.parse(value) : value;
}

export async function listRealtimeNodes(prefixPath) {
  if (!prefixPath) {
    const [rows] = await pool.query("SELECT path, value FROM rt_nodes");
    return rows;
  }

  const [rows] = await pool.query(
    `SELECT path, value
     FROM rt_nodes
     WHERE path = ? OR path LIKE CONCAT(?, '/%')`,
    [prefixPath, prefixPath]
  );
  return rows;
}

export async function findExactRealtimeNode(path) {
  const [rows] = await pool.query(
    `SELECT path, value
     FROM rt_nodes
     WHERE path = ?
     LIMIT 1`,
    [path]
  );
  return rows[0] || null;
}

export async function findRealtimeNodesByCandidates(candidates) {
  if (!candidates.length) {
    return [];
  }

  const placeholders = candidates.map(() => "?").join(", ");
  const [rows] = await pool.query(
    `SELECT path, value
     FROM rt_nodes
     WHERE path IN (${placeholders})`,
    candidates
  );
  return rows;
}

export async function upsertRealtimeNode(path, value) {
  await pool.query(
    `INSERT INTO rt_nodes (path, value)
     VALUES (?, CAST(? AS JSON))
     ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = CURRENT_TIMESTAMP`,
    [path, JSON.stringify(value)]
  );
}

export async function deleteRealtimePath(path) {
  if (!path) {
    await pool.query("DELETE FROM rt_nodes");
    return;
  }

  await pool.query(
    `DELETE FROM rt_nodes
     WHERE path = ? OR path LIKE CONCAT(?, '/%')`,
    [path, path]
  );
}