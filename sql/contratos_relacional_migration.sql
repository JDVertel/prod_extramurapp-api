USE extramurapp;

-- 1) Tabla padre de contratos (sin columna JSON cups)
CREATE TABLE IF NOT EXISTS contratos (
  id VARCHAR(36) PRIMARY KEY,
  eps_id VARCHAR(36) NULL,
  eps_nombre VARCHAR(190) NOT NULL,
  fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_contratos_eps_id (eps_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2) Tabla hija relacional de cups del contrato
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3) Si existe contratos.cups legacy, migrar a contrato_cups (MySQL 8+)
SET @has_cups_col := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'contratos' AND COLUMN_NAME = 'cups'
);

SET @sql_migrate_cups := IF(
  @has_cups_col > 0,
  'INSERT INTO contrato_cups (id, contrato_id, eps_id, eps_nombre, cups_id, cups_nombre, actividad_id, actividad_nombre, cups_profesional, cups_grupo)
   SELECT
     UUID(),
     c.id,
     NULLIF(JSON_UNQUOTE(JSON_EXTRACT(j.item, ''$.epsId'')), ''''),
     COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(j.item, ''$.epsNombre'')), ''''), c.eps_nombre),
     NULLIF(JSON_UNQUOTE(JSON_EXTRACT(j.item, ''$.cupsId'')), ''''),
     NULLIF(JSON_UNQUOTE(JSON_EXTRACT(j.item, ''$.cupsNombre'')), ''''),
     NULLIF(JSON_UNQUOTE(JSON_EXTRACT(j.item, ''$.actividadId'')), ''''),
     NULLIF(JSON_UNQUOTE(JSON_EXTRACT(j.item, ''$.actividadNombre'')), ''''),
     REPLACE(REPLACE(REPLACE(JSON_EXTRACT(j.item, ''$.cupsProfesional''), ''["'', ''''), ''"]'', ''''), ''","'', '', ''),
     NULLIF(JSON_UNQUOTE(JSON_EXTRACT(j.item, ''$.cupsGrupo'')), '''')
   FROM contratos c
   JOIN JSON_TABLE(c.cups, ''$[*]'' COLUMNS (item JSON PATH ''$'')) j
   WHERE c.cups IS NOT NULL
   ON DUPLICATE KEY UPDATE
     eps_id = VALUES(eps_id),
     eps_nombre = VALUES(eps_nombre),
     cups_nombre = VALUES(cups_nombre),
     actividad_nombre = VALUES(actividad_nombre),
     cups_profesional = VALUES(cups_profesional),
     cups_grupo = VALUES(cups_grupo)',
  'SELECT 1'
);

PREPARE stmt_migrate_cups FROM @sql_migrate_cups;
EXECUTE stmt_migrate_cups;
DEALLOCATE PREPARE stmt_migrate_cups;

-- 4) Eliminar columna legacy JSON cups para forzar modelo relacional
SET @sql_drop_cups := IF(
  @has_cups_col > 0,
  'ALTER TABLE contratos DROP COLUMN cups',
  'SELECT 1'
);
PREPARE stmt_drop_cups FROM @sql_drop_cups;
EXECUTE stmt_drop_cups;
DEALLOCATE PREPARE stmt_drop_cups;

-- 5) Extra recomendado: metadatos relacionales en asignaciones
ALTER TABLE asignaciones
  ADD COLUMN IF NOT EXISTS key_ref VARCHAR(100) NULL AFTER encuesta_id,
  ADD COLUMN IF NOT EXISTS nombre_prof VARCHAR(190) NULL AFTER key_ref,
  ADD COLUMN IF NOT EXISTS convenio VARCHAR(120) NULL AFTER nombre_prof;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
