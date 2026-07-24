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
    if (await ensureColumn("users", "telefono", "VARCHAR(40) NULL AFTER num_documento")) {
      added.push("users.telefono");
    }

    if (await ensureColumn("users", "fecha_fin_contrato", "DATE NULL AFTER telefono")) {
      added.push("users.fecha_fin_contrato");
    }

    console.log("Migracion de telefono y fecha_fin_contrato en users completada.");
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
  console.error("Error en migracion de telefono/fecha_fin_contrato:", error);
  process.exitCode = 1;
});
