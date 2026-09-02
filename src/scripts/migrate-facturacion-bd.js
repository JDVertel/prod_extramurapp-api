/**
 * Migración consolidada para facturación + BDS_EPS.
 *
 * Cubre los cambios de BD requeridos por:
 * - Módulo BDS_EPS (eps_bd, eps_bd_registros)
 * - Cierre en depuración y bandejas de facturación
 * - Índices de rendimiento relacionados
 *
 * Los cambios solo de frontend (reactivo, orden columna Facturable) NO tocan la BD.
 *
 * Uso:
 *   cd prod_extramurapp-api
 *   npm run migrate:facturacion-bd
 */
import { ensureEpsBdTables } from "../repositories/eps-bd.repository.js";
import { pool } from "../utils/database.js";
import { config } from "../utils/config.js";

async function columnExists(tableName, columnName) {
  const [rows] = await pool.query(`SHOW COLUMNS FROM ${tableName} LIKE ?`, [columnName]);
  return rows.length > 0;
}

async function indexExists(tableName, indexName) {
  const [rows] = await pool.query(`SHOW INDEX FROM ${tableName} WHERE Key_name = ?`, [indexName]);
  return rows.length > 0;
}

async function addColumnIfMissing(tableName, columnName, ddl) {
  if (await columnExists(tableName, columnName)) {
    console.log(`[OK] ${tableName}.${columnName}`);
    return false;
  }

  await pool.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${ddl}`);
  console.log(`[ADD] ${tableName}.${columnName}`);
  return true;
}

async function addIndexIfMissing(tableName, indexName, ddlColumns) {
  if (await indexExists(tableName, indexName)) {
    console.log(`[OK] index ${tableName}.${indexName}`);
    return false;
  }

  await pool.query(`ALTER TABLE ${tableName} ADD INDEX ${indexName} (${ddlColumns})`);
  console.log(`[ADD] index ${tableName}.${indexName}`);
  return true;
}

async function ensureEncuestasFacturacionColumns() {
  console.log("\n== encuestas: columnas de facturación ==");
  await addColumnIfMissing("encuestas", "status_facturacion", "TINYINT(1) NOT NULL DEFAULT 0");
  await addColumnIfMissing("encuestas", "fecha_facturacion", "DATETIME NULL");
  await addColumnIfMissing("encuestas", "asig_fact", "VARCHAR(36) NULL");
}

async function ensureAsignacionCupsFacturacionColumns() {
  console.log("\n== asignacion_cups: columnas de facturación ==");
  await addColumnIfMissing("asignacion_cups", "fact_num", "VARCHAR(80) NULL");
  await addColumnIfMissing("asignacion_cups", "fact_prof", "VARCHAR(36) NULL");
  await addColumnIfMissing("asignacion_cups", "facturado", "TINYINT(1) NULL");
  await addColumnIfMissing("asignacion_cups", "fecha_facturacion", "DATETIME NULL");
}

async function ensureEpsBd() {
  console.log("\n== BDS_EPS: tablas eps_bd y eps_bd_registros ==");
  await ensureEpsBdTables();
  console.log("[OK] eps_bd");
  console.log("[OK] eps_bd_registros");

  await addIndexIfMissing(
    "eps_bd_registros",
    "idx_eps_bd_registros_doc",
    "tipo_documento, numdoc"
  );
}

async function ensureFacturacionIndexes() {
  console.log("\n== índices de facturación ==");

  await addIndexIfMissing(
    "encuestas",
    "idx_encuestas_status_facturacion",
    "status_facturacion"
  );
  await addIndexIfMissing(
    "encuestas",
    "idx_encuestas_fact_aprov",
    "convenio, status_facturacion, asig_fact, fecha_gest_enfermera"
  );
  await addIndexIfMissing(
    "encuestas",
    "idx_encuestas_facturador_pendientes",
    "asig_fact, status_facturacion, fecha_facturacion"
  );
  await addIndexIfMissing(
    "asignacion_cups",
    "idx_asignacion_cups_fact_estado",
    "encuesta_id, facturado, fact_num"
  );
  await addIndexIfMissing(
    "asignacion_cups",
    "idx_asignacion_cups_fact_prof",
    "fact_prof, facturado, encuesta_id"
  );
}

async function main() {
  const { mysql } = config;
  console.log("Migración facturación + BDS_EPS");
  console.log(`Base de datos: ${mysql.user}@${mysql.host}:${mysql.port}/${mysql.database}`);

  await ensureEpsBd();
  await ensureEncuestasFacturacionColumns();
  await ensureAsignacionCupsFacturacionColumns();
  await ensureFacturacionIndexes();

  console.log("\n[migrate:facturacion-bd] Completado. Estructura verificada.");
  await pool.end();
}

main().catch(async (error) => {
  console.error("[migrate:facturacion-bd] Error:", {
    message: error?.message,
    code: error?.code,
    sqlMessage: error?.sqlMessage,
  });
  try {
    await pool.end();
  } catch (_) {
    // ignore
  }
  process.exit(1);
});
