import { pool } from "../utils/database.js";

async function migrateUserBandejas() {
  try {
    const [rows] = await pool.query("SHOW COLUMNS FROM users LIKE 'bandejas'");

    if (Array.isArray(rows) && rows.length > 0) {
      console.log("La columna bandejas ya existe en users.");
      return;
    }

    await pool.query("ALTER TABLE users ADD COLUMN bandejas JSON NULL AFTER activo");
    console.log("Migracion completada: columna bandejas agregada a users.");
  } catch (error) {
    console.error("Error ejecutando migracion de bandejas:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrateUserBandejas();
