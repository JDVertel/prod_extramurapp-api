import { pool } from "../utils/database.js";

async function indexExists(tableName, indexName) {
  const [rows] = await pool.query(`SHOW INDEX FROM ${tableName} WHERE Key_name = ?`, [indexName]);
  return rows.length > 0;
}

async function foreignKeyExists(tableName, fkName) {
  const [rows] = await pool.query(
    `SELECT CONSTRAINT_NAME
     FROM information_schema.REFERENTIAL_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND CONSTRAINT_NAME = ?`,
    [tableName, fkName]
  );
  return rows.length > 0;
}

async function addIndexIfMissing(tableName, indexName, ddlColumns) {
  if (await indexExists(tableName, indexName)) {
    console.log(`OK index ${indexName}`);
    return;
  }

  await pool.query(`ALTER TABLE ${tableName} ADD INDEX ${indexName} (${ddlColumns})`);
  console.log(`ADD index ${indexName}`);
}

async function addForeignKeyIfMissing({ tableName, fkName, columnName, refTable, refColumn, onDelete = "CASCADE" }) {
  if (await foreignKeyExists(tableName, fkName)) {
    console.log(`OK fk ${fkName}`);
    return;
  }

  const [orphans] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM ${tableName} t
     LEFT JOIN ${refTable} r ON r.${refColumn} = t.${columnName}
     WHERE t.${columnName} IS NOT NULL
       AND r.${refColumn} IS NULL`
  );

  if (Number(orphans?.[0]?.total || 0) > 0) {
    console.warn(`SKIP fk ${fkName}: existen huerfanos en ${tableName}.${columnName}`);
    return;
  }

  await pool.query(
    `ALTER TABLE ${tableName}
     ADD CONSTRAINT ${fkName}
     FOREIGN KEY (${columnName}) REFERENCES ${refTable}(${refColumn}) ON DELETE ${onDelete}`
  );
  console.log(`ADD fk ${fkName}`);
}

async function run() {
  await addIndexIfMissing("users", "idx_users_ips_nombre", "ips_id, nombre");
  await addIndexIfMissing("users", "idx_users_cargo_activo", "cargo, activo");

  await addIndexIfMissing("encuestas", "idx_encuestas_aux_bandeja", "id_encuestador, status_gest_aux, status_visita");
  await addIndexIfMissing("encuestas", "idx_encuestas_medico_bandeja", "id_medico_atiende, status_gest_aux, status_gest_medica");
  await addIndexIfMissing("encuestas", "idx_encuestas_enfermero_bandeja", "id_enfermero_atiende, status_gest_aux, status_gest_enfermera");
  await addIndexIfMissing("encuestas", "idx_encuestas_psicologo_bandeja", "id_psicologo_atiende, status_gest_aux, status_gest_psicologo");
  await addIndexIfMissing("encuestas", "idx_encuestas_tsocial_bandeja", "id_tsocial_atiende, status_gest_aux, status_gest_tsocial");
  await addIndexIfMissing("encuestas", "idx_encuestas_nutricionista_bandeja", "id_nutricionista_atiende, status_gest_aux, status_gest_nutricionista");
  await addIndexIfMissing("encuestas", "idx_encuestas_convenio_fecha", "convenio, fecha");
  await addIndexIfMissing("encuestas", "idx_encuestas_numdoc_tipodoc", "numdoc, tipodoc");
  await addIndexIfMissing("encuestas", "idx_encuestas_fact_aprov", "convenio, status_facturacion, asig_fact, fecha_gest_enfermera");
  await addIndexIfMissing("encuestas", "idx_encuestas_facturador_pendientes", "asig_fact, status_facturacion, fecha_facturacion");
  await addIndexIfMissing("encuestas", "idx_encuestas_fact_ips_fecha", "ips_id, status_facturacion, fecha_facturacion");
  await addIndexIfMissing("encuestas", "idx_encuestas_fact_aux", "id_encuestador, status_facturacion, fecha_facturacion");
  await addIndexIfMissing("encuestas", "idx_encuestas_fact_medico", "id_medico_atiende, status_facturacion, fecha_facturacion");
  await addIndexIfMissing("encuestas", "idx_encuestas_fact_enfermero", "id_enfermero_atiende, status_facturacion, fecha_facturacion");
  await addIndexIfMissing("encuestas", "idx_encuestas_fact_psicologo", "id_psicologo_atiende, status_facturacion, fecha_facturacion");
  await addIndexIfMissing("encuestas", "idx_encuestas_fact_tsocial", "id_tsocial_atiende, status_facturacion, fecha_facturacion");
  await addIndexIfMissing("encuestas", "idx_encuestas_fact_nutricionista", "id_nutricionista_atiende, status_facturacion, fecha_facturacion");

  await addIndexIfMissing("encuesta_actividades", "idx_encuesta_actividades_encuesta_ips", "encuesta_id, ips_id");
  await addIndexIfMissing("asignacion_cups", "idx_asignacion_cups_encuesta_actividad", "encuesta_id, actividad_id");
  await addIndexIfMissing("asignacion_cups", "idx_asignacion_cups_encuesta_fact_key", "encuesta_id, facturado, key_ref");
  await addIndexIfMissing("asignacion_cups", "idx_asignacion_cups_fact_prof", "fact_prof, facturado, encuesta_id");
  await addIndexIfMissing("asignacion_cups", "idx_asignacion_cups_fact_estado", "encuesta_id, facturado, fact_num");
  await addIndexIfMissing("asignacion_cups", "idx_asignacion_cups_key_fact", "key_ref, facturado, encuesta_id");

  await addForeignKeyIfMissing({
    tableName: "contrato_cups",
    fkName: "fk_contrato_cups_contrato",
    columnName: "contrato_id",
    refTable: "contratos",
    refColumn: "id",
    onDelete: "CASCADE",
  });

  await addForeignKeyIfMissing({
    tableName: "asignacion_cups",
    fkName: "fk_asignacion_cups_encuesta",
    columnName: "encuesta_id",
    refTable: "encuestas",
    refColumn: "id",
    onDelete: "CASCADE",
  });
}

run()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("Error asegurando índices y llaves:", error);
    await pool.end();
    process.exit(1);
  });