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
    const columns = [
      ["departamento_nacimiento", "VARCHAR(120) NULL AFTER sexo"],
      ["municipio_nacimiento", "VARCHAR(120) NULL AFTER departamento_nacimiento"],
      ["identidad_genero", "VARCHAR(80) NULL AFTER municipio_nacimiento"],
      ["ocupacion", "VARCHAR(80) NULL AFTER identidad_genero"],
      ["nivel_ocupacion", "VARCHAR(80) NULL AFTER ocupacion"],
    ];

    for (const [columnName, ddl] of columns) {
      if (await ensureColumn("encuestas", columnName, ddl)) {
        added.push(`encuestas.${columnName}`);
      }
    }

    console.log("Migracion de datos adicionales del paciente en encuestas completada.");
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
  console.error("Error en migracion de datos adicionales del paciente:", error);
  process.exitCode = 1;
});
