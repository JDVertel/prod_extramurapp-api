import { pool } from "../utils/database.js";

async function columnExists(tableName, columnName) {
  const [rows] = await pool.query(
    `SELECT 1 AS ok
       FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND column_name = ?
      LIMIT 1`,
    [tableName, columnName]
  );
  return rows.length > 0;
}

async function ensureColumn(tableName, columnName, ddl) {
  if (await columnExists(tableName, columnName)) {
    return false;
  }

  await pool.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${ddl}`);
  return true;
}

async function run() {
  const added = [];

  try {
    if (await ensureColumn("users", "failed_login_attempts", "INT NOT NULL DEFAULT 0")) {
      added.push("users.failed_login_attempts");
    }

    if (await ensureColumn("users", "lock_level", "TINYINT NOT NULL DEFAULT 0")) {
      added.push("users.lock_level");
    }

    if (await ensureColumn("users", "locked_until", "DATETIME NULL")) {
      added.push("users.locked_until");
    }

    if (await ensureColumn("users", "is_locked", "TINYINT(1) NOT NULL DEFAULT 0")) {
      added.push("users.is_locked");
    }

    console.log("Migracion de seguridad de login completada.");
    if (!added.length) {
      console.log("No hubo cambios: la BD ya estaba actualizada.");
    } else {
      console.log("Elementos agregados:");
      added.forEach((item) => console.log(`- ${item}`));
    }
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error("Error en migracion de seguridad de login:", error);
  process.exitCode = 1;
});
