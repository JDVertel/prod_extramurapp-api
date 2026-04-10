import { pool } from "../utils/database.js";

async function migrateUserAccesosProfesionales() {
  try {
    const [rows] = await pool.query("SHOW COLUMNS FROM users LIKE 'accesos_profesionales'");

    if (Array.isArray(rows) && rows.length > 0) {
      console.log("La columna accesos_profesionales ya existe en users.");
      return;
    }

    await pool.query("ALTER TABLE users ADD COLUMN accesos_profesionales JSON NULL AFTER bandejas");
    console.log("Migracion completada: columna accesos_profesionales agregada a users.");
  } catch (error) {
    console.error("Error ejecutando migracion de accesos_profesionales:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrateUserAccesosProfesionales();
