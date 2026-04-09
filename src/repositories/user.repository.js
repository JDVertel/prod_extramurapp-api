import { pool } from "../utils/database.js";

export async function findUserIdByEmail(email) {
  const [rows] = await pool.query("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
  return rows[0] || null;
}

export async function findUserIdByDocument(numDocumento) {
  const [rows] = await pool.query("SELECT id FROM users WHERE num_documento = ? LIMIT 1", [numDocumento]);
  return rows[0] || null;
}

export async function findUserForLogin(email) {
  const [rows] = await pool.query(
    `SELECT id, email, password_hash, nombre, cargo, ips_id, convenio, grupo, num_documento, activo, must_change_password
     FROM users
     WHERE email = ?
     LIMIT 1`,
    [email]
  );
  return rows[0] || null;
}

export async function findUserById(id) {
  const [rows] = await pool.query(
    `SELECT id, email, nombre, cargo, ips_id, convenio, grupo, num_documento, activo, must_change_password, created_at, updated_at
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

export async function listUsers() {
  const [rows] = await pool.query(
    `SELECT id, email, nombre, cargo, ips_id, convenio, grupo, num_documento, activo, must_change_password, created_at, updated_at
     FROM users
     ORDER BY nombre ASC`
  );
  return rows;
}

export async function listUsersByIpsId(ipsId) {
  if (!ipsId) {
    return [];
  }

  const [rows] = await pool.query(
    `SELECT id, email, nombre, cargo, ips_id, convenio, grupo, num_documento, activo, must_change_password, created_at, updated_at
     FROM users
     WHERE ips_id = ?
     ORDER BY nombre ASC`,
    [ipsId]
  );

  return rows;
}

export async function findUserByIdAndIps(id, ipsId) {
  if (!ipsId) {
    return null;
  }

  const [rows] = await pool.query(
    `SELECT id, email, nombre, cargo, ips_id, convenio, grupo, num_documento, activo, must_change_password, created_at, updated_at
     FROM users
     WHERE id = ? AND ips_id = ?
     LIMIT 1`,
    [id, ipsId]
  );

  return rows[0] || null;
}

export async function createUser(user) {
  const columns = ["id", "email", "password_hash", "nombre", "cargo", "ips_id", "convenio", "grupo", "num_documento", "activo", "must_change_password"];
  const values = [
    user.id,
    user.email,
    user.passwordHash,
    user.nombre,
    user.cargo,
    user.ipsId,
    user.convenio,
    user.grupo,
    user.numDocumento,
    user.activo,
    user.mustChangePassword,
  ];

  const placeholders = columns.map(() => "?").join(", ");
  await pool.query(
    `INSERT INTO users (${columns.join(", ")}) VALUES (${placeholders})`,
    values
  );
}

export async function updateUser(id, updates) {
  const fields = [];
  const values = [];

  Object.entries(updates).forEach(([column, value]) => {
    if (value !== undefined) {
      fields.push(`${column} = ?`);
      values.push(value);
    }
  });

  if (!fields.length) {
    return 0;
  }

  values.push(id);
  const [result] = await pool.query(
    `UPDATE users SET ${fields.join(", ")} WHERE id = ?`,
    values
  );
  return result.affectedRows;
}

export async function deleteUser(id) {
  const [result] = await pool.query("DELETE FROM users WHERE id = ?", [id]);
  return result.affectedRows;
}

export async function createPasswordResetToken({ userId, token }) {
  await pool.query(
    `INSERT INTO password_reset_tokens (user_id, token, expires_at)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))`,
    [userId, token]
  );
}

export async function findValidPasswordResetToken(token) {
  const [rows] = await pool.query(
    `SELECT id, user_id
     FROM password_reset_tokens
     WHERE token = ? AND used_at IS NULL AND expires_at > NOW()
     LIMIT 1`,
    [token]
  );
  return rows[0] || null;
}

export async function markPasswordResetTokenAsUsed(id) {
  await pool.query("UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?", [id]);
}