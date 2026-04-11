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

async function indexExists(tableName, indexName) {
  const [rows] = await pool.query(
    `SELECT 1 AS ok
       FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND index_name = ?
      LIMIT 1`,
    [tableName, indexName]
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

async function ensureIndex(tableName, indexName, columnName) {
  if (await indexExists(tableName, indexName)) {
    return false;
  }

  await pool.query(`ALTER TABLE ${tableName} ADD INDEX ${indexName} (${columnName})`);
  return true;
}

async function run() {
  const added = [];

  try {
    if (await ensureColumn("encuestas", "id_nutricionista_atiende", "VARCHAR(36) NULL AFTER id_tsocial_atiende")) {
      added.push("encuestas.id_nutricionista_atiende");
    }

    if (await ensureColumn("encuestas", "status_gest_nutricionista", "TINYINT(1) NOT NULL DEFAULT 0 AFTER status_gest_tsocial")) {
      added.push("encuestas.status_gest_nutricionista");
    }

    if (await ensureColumn("encuestas", "fecha_gest_nutricionista", "DATETIME NULL AFTER fecha_gest_tsocial")) {
      added.push("encuestas.fecha_gest_nutricionista");
    }

    if (await ensureIndex("encuestas", "idx_encuestas_id_nutricionista_atiende", "id_nutricionista_atiende")) {
      added.push("INDEX idx_encuestas_id_nutricionista_atiende");
    }

    console.log("Migracion de columnas de nutricionista completada.");
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
  console.error("Error en migracion de columnas de nutricionista:", error);
  process.exitCode = 1;
});
