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

async function getColumnType(tableName, columnName) {
  const [rows] = await pool.query(
    `SELECT COLUMN_TYPE AS columnType
       FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND column_name = ?
      LIMIT 1`,
    [tableName, columnName]
  );
  return rows[0]?.columnType || null;
}

async function ensureColumnSize(tableName, columnName, ddl) {
  if (!(await columnExists(tableName, columnName))) {
    await pool.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${ddl}`);
    return `added ${tableName}.${columnName}`;
  }

  const currentType = String(await getColumnType(tableName, columnName) || "").toLowerCase();
  const desired = String(ddl).toLowerCase();
  if (currentType.includes("varchar(255)") || currentType.includes("varchar(120)")) {
    // Si ya es suficientemente amplio para el campo, no forzar.
    if (
      (columnName === "identidad_genero" && currentType.includes("varchar(120)")) ||
      (columnName !== "identidad_genero" && currentType.includes("varchar(255)"))
    ) {
      return null;
    }
  }

  if (currentType === desired.replace(/\s+null$/i, "").trim()) {
    return null;
  }

  await pool.query(`ALTER TABLE ${tableName} MODIFY COLUMN ${columnName} ${ddl}`);
  return `modified ${tableName}.${columnName} -> ${ddl}`;
}

async function run() {
  const changes = [];

  try {
    const ops = [
      ["encuestas", "identidad_genero", "VARCHAR(120) NULL"],
      ["encuestas", "ocupacion", "VARCHAR(255) NULL"],
      ["encuestas", "nivel_ocupacion", "VARCHAR(255) NULL"],
    ];

    for (const [table, column, ddl] of ops) {
      const result = await ensureColumnSize(table, column, ddl);
      if (result) changes.push(result);
    }

    console.log("Migracion de longitudes de datos de paciente completada.");
    if (!changes.length) {
      console.log("No hubo cambios: la BD ya estaba actualizada.");
    } else {
      console.log("Cambios:");
      changes.forEach((item) => console.log(`- ${item}`));
    }
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error("Error en migracion de longitudes de datos de paciente:", error);
  process.exitCode = 1;
});
