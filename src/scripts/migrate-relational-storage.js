import { randomUUID } from "node:crypto";
import { pool } from "../utils/database.js";

async function tableExists(tableName) {
  const [rows] = await pool.query(
    `SELECT 1 AS ok
       FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = ?
      LIMIT 1`,
    [tableName]
  );
  return rows.length > 0;
}

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

function parseJsonSafe(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function toArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value && typeof value === "object") return Object.values(value).filter(Boolean);
  return [];
}

function toText(value) {
  if (value === null || value === undefined) return null;
  const out = String(value).trim();
  return out || null;
}

async function ensureRelationalTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS contrato_cups (
      id VARCHAR(36) PRIMARY KEY,
      contrato_id VARCHAR(36) NOT NULL,
      eps_id VARCHAR(36) NULL,
      eps_nombre VARCHAR(190) NOT NULL,
      cups_id VARCHAR(36) NOT NULL,
      cups_nombre VARCHAR(255) NOT NULL,
      actividad_id VARCHAR(60) NULL,
      actividad_nombre VARCHAR(190) NULL,
      cups_profesional VARCHAR(255) NULL,
      cups_grupo VARCHAR(120) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_contrato_cups_contrato (contrato_id),
      INDEX idx_contrato_cups_cups (cups_id),
      INDEX idx_contrato_cups_actividad (actividad_id),
      UNIQUE KEY uq_contrato_cups (contrato_id, cups_id, actividad_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS asignacion_cups (
      id VARCHAR(36) PRIMARY KEY,
      encuesta_id VARCHAR(36) NOT NULL,
      key_ref VARCHAR(100) NULL,
      nombre_prof VARCHAR(190) NULL,
      convenio VARCHAR(120) NULL,
      actividad_id VARCHAR(60) NULL,
      cups_id VARCHAR(36) NOT NULL,
      cups_nombre VARCHAR(255) NOT NULL,
      cups_codigo VARCHAR(40) NULL,
      cups_grupo VARCHAR(120) NULL,
      cantidad INT NULL,
      detalle TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_asignacion_cups_encuesta (encuesta_id),
      INDEX idx_asignacion_cups_actividad (actividad_id),
      INDEX idx_asignacion_cups_cups (cups_id),
      UNIQUE KEY uq_asignacion_cups (encuesta_id, cups_id, actividad_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  if (!(await columnExists("asignaciones", "key_ref"))) {
    await pool.query(`ALTER TABLE asignaciones ADD COLUMN key_ref VARCHAR(100) NULL AFTER encuesta_id`);
  }
  if (!(await columnExists("asignaciones", "nombre_prof"))) {
    await pool.query(`ALTER TABLE asignaciones ADD COLUMN nombre_prof VARCHAR(190) NULL AFTER key_ref`);
  }
  if (!(await columnExists("asignaciones", "convenio"))) {
    await pool.query(`ALTER TABLE asignaciones ADD COLUMN convenio VARCHAR(120) NULL AFTER nombre_prof`);
  }
}

async function migrateContratos() {
  const hasCupsJson = await columnExists("contratos", "cups");
  if (!hasCupsJson) {
    return { migratedRows: 0, migratedCups: 0 };
  }

  const [rows] = await pool.query(`SELECT id, eps_id, eps_nombre, cups FROM contratos`);
  let migratedCups = 0;

  for (const row of rows) {
    const cups = toArray(parseJsonSafe(row.cups, []));
    for (const cup of cups) {
      const cupsId = toText(cup?.cupsId ?? cup?.id);
      const cupsNombre = toText(cup?.cupsNombre ?? cup?.DescripcionCUP);
      if (!cupsId || !cupsNombre) continue;

      const cupsProfesionalRaw = cup?.cupsProfesional;
      const cupsProfesional = Array.isArray(cupsProfesionalRaw)
        ? cupsProfesionalRaw.map((it) => String(it || "").trim()).filter(Boolean).join(", ")
        : toText(cupsProfesionalRaw);

      await pool.query(
        `INSERT INTO contrato_cups
          (id, contrato_id, eps_id, eps_nombre, cups_id, cups_nombre, actividad_id, actividad_nombre, cups_profesional, cups_grupo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           eps_id = VALUES(eps_id),
           eps_nombre = VALUES(eps_nombre),
           cups_nombre = VALUES(cups_nombre),
           actividad_nombre = VALUES(actividad_nombre),
           cups_profesional = VALUES(cups_profesional),
           cups_grupo = VALUES(cups_grupo)`,
        [
          randomUUID(),
          row.id,
          toText(cup?.epsId) || toText(row.eps_id),
          toText(cup?.epsNombre) || toText(row.eps_nombre) || "",
          cupsId,
          cupsNombre,
          toText(cup?.actividadId),
          toText(cup?.actividadNombre),
          cupsProfesional,
          toText(cup?.cupsGrupo ?? cup?.Grupo ?? cup?.grupo),
        ]
      );
      migratedCups += 1;
    }
  }

  return { migratedRows: rows.length, migratedCups };
}

async function migrateAsignaciones() {
  const hasDatosJson = await columnExists("asignaciones", "datos");
  if (!hasDatosJson) {
    return { migratedRows: 0, migratedCups: 0 };
  }

  const [rows] = await pool.query(`SELECT encuesta_id, datos FROM asignaciones`);
  let migratedCups = 0;

  for (const row of rows) {
    const datos = parseJsonSafe(row.datos, {});
    const keyRef = toText(datos?.key);
    const nombreProf = toText(datos?.nombreProf ?? datos?.nombrePtof);
    const convenio = toText(datos?.convenio);

    await pool.query(
      `UPDATE asignaciones
          SET key_ref = COALESCE(?, key_ref),
              nombre_prof = COALESCE(?, nombre_prof),
              convenio = COALESCE(?, convenio)
        WHERE encuesta_id = ?`,
      [keyRef, nombreProf, convenio, row.encuesta_id]
    );

    const cups = toArray(datos?.cups);
    for (const cup of cups) {
      const cupsId = toText(cup?.cupsId ?? cup?.id);
      const cupsNombre = toText(cup?.cupsNombre ?? cup?.DescripcionCUP);
      if (!cupsId || !cupsNombre) continue;

      await pool.query(
        `INSERT INTO asignacion_cups
          (id, encuesta_id, key_ref, nombre_prof, convenio, actividad_id, cups_id, cups_nombre, cups_codigo, cups_grupo, cantidad, detalle)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           key_ref = VALUES(key_ref),
           nombre_prof = VALUES(nombre_prof),
           convenio = VALUES(convenio),
           cups_nombre = VALUES(cups_nombre),
           cups_codigo = VALUES(cups_codigo),
           cups_grupo = VALUES(cups_grupo),
           cantidad = VALUES(cantidad),
           detalle = VALUES(detalle)`,
        [
          randomUUID(),
          row.encuesta_id,
          toText(cup?.key) || keyRef,
          toText(cup?.nombreProf ?? cup?.nombrePtof) || nombreProf,
          toText(cup?.convenio) || convenio,
          toText(cup?.actividadId),
          cupsId,
          cupsNombre,
          toText(cup?.codigo),
          toText(cup?.Grupo ?? cup?.grupo),
          Number.isFinite(Number(cup?.cantidad)) ? Number(cup.cantidad) : null,
          toText(cup?.detalle),
        ]
      );
      migratedCups += 1;
    }
  }

  return { migratedRows: rows.length, migratedCups };
}

async function dropLegacyColumnsIfRequested() {
  const shouldDrop = String(process.env.DROP_LEGACY_JSON || "0") === "1";
  if (!shouldDrop) {
    return;
  }

  if (await columnExists("contratos", "cups")) {
    await pool.query(`ALTER TABLE contratos DROP COLUMN cups`);
  }

  if (await columnExists("asignaciones", "datos")) {
    await pool.query(`ALTER TABLE asignaciones DROP COLUMN datos`);
  }
}

async function run() {
  try {
    if (!(await tableExists("contratos")) || !(await tableExists("asignaciones"))) {
      throw new Error("No existen las tablas base contratos/asignaciones en la BD actual.");
    }

    await ensureRelationalTables();

    const contratos = await migrateContratos();
    const asignaciones = await migrateAsignaciones();

    await dropLegacyColumnsIfRequested();

    console.log("Migracion relacional completada.");
    console.log(JSON.stringify({ contratos, asignaciones }, null, 2));
    console.log("Si deseas eliminar columnas JSON legacy, ejecuta con DROP_LEGACY_JSON=1.");
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error("Error en migracion relacional:", error);
  process.exitCode = 1;
});
