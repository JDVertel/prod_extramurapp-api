import { pool } from "../utils/database.js";

const TABLE_NAME = "asignacion_cups";

const REQUIRED_COLUMNS = [
  { name: "fact_num", ddl: "VARCHAR(80) NULL" },
  { name: "fact_prof", ddl: "VARCHAR(36) NULL" },
  { name: "facturado", ddl: "TINYINT(1) NULL" },
  { name: "fecha_facturacion", ddl: "DATETIME NULL" },
];

async function getExistingColumns() {
  const [rows] = await pool.query(`SHOW COLUMNS FROM ${TABLE_NAME}`);
  return new Set(rows.map((row) => String(row.Field || "").trim()).filter(Boolean));
}

async function run() {
  try {
    const existing = await getExistingColumns();
    let createdCount = 0;

    for (const col of REQUIRED_COLUMNS) {
      if (existing.has(col.name)) {
        console.log(`[OK] Columna existente: ${col.name}`);
        continue;
      }

      try {
        await pool.query(`ALTER TABLE ${TABLE_NAME} ADD COLUMN ${col.name} ${col.ddl}`);
        createdCount += 1;
        console.log(`[ADD] Columna creada: ${col.name}`);
      } catch (error) {
        if (error?.code === "ER_DUP_FIELDNAME") {
          console.log(`[SKIP] Columna ya existe por carrera: ${col.name}`);
          continue;
        }
        throw error;
      }
    }

    const [verifyRows] = await pool.query(
      `SHOW COLUMNS FROM ${TABLE_NAME} WHERE Field IN ('fact_num','fact_prof','facturado','fecha_facturacion')`
    );

    const names = verifyRows.map((row) => row.Field).join(", ");
    console.log(`Verificacion columnas facturacion en ${TABLE_NAME}: ${names}`);
    console.log(`Migracion completada. Nuevas columnas: ${createdCount}`);
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error("Error en migracion de columnas de facturacion:", {
    message: error?.message,
    code: error?.code,
    sqlMessage: error?.sqlMessage,
  });
  process.exit(1);
});
