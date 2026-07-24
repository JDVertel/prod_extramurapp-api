import { pool } from "../utils/database.js";

/**
 * Renombra el convenio "Unides" -> "Unidesa" en tablas que lo almacenan.
 * Idempotente: solo afecta filas con valor exacto "Unides" (case-insensitive trim).
 */
async function run() {
  const updates = [
    ["users", "convenio"],
    ["encuestas", "convenio"],
    ["asignaciones", "convenio"],
    ["actividades_cups", "convenio"],
  ];

  try {
    for (const [tableName, columnName] of updates) {
      const [cols] = await pool.query(
        `SELECT 1 AS ok
           FROM information_schema.columns
          WHERE table_schema = DATABASE()
            AND table_name = ?
            AND column_name = ?
          LIMIT 1`,
        [tableName, columnName]
      );

      if (!cols.length) {
        console.log(`SKIP ${tableName}.${columnName}: columna no existe`);
        continue;
      }

      const [result] = await pool.query(
        `UPDATE \`${tableName}\`
            SET \`${columnName}\` = 'Unidesa'
          WHERE LOWER(TRIM(\`${columnName}\`)) = 'unides'`
      );

      console.log(
        `${tableName}.${columnName}: ${result?.affectedRows ?? 0} fila(s) actualizada(s) a Unidesa`
      );
    }

    console.log("Migracion de convenio Unides -> Unidesa completada.");
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error("Error en migracion Unides -> Unidesa:", error);
  process.exitCode = 1;
});
