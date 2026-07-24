-- ============================================================
-- Migración pendiente pre-push (idempotente)
-- Incluye columnas nuevas + índices de rendimiento +
-- índices para mantenimiento BD (consulta docs / huérfanos).
-- Aplicar en MySQL antes de desplegar el código nuevo.
-- Base de datos: extramurapp
-- ============================================================

USE extramurapp;

DROP PROCEDURE IF EXISTS add_column_if_missing;
DROP PROCEDURE IF EXISTS modify_column_if_needed;
DROP PROCEDURE IF EXISTS add_index_if_missing;

DELIMITER $$

CREATE PROCEDURE add_column_if_missing(
  IN p_table_name VARCHAR(64),
  IN p_column_name VARCHAR(64),
  IN p_column_ddl TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = p_table_name
      AND column_name = p_column_name
  ) THEN
    SET @ddl = CONCAT(
      'ALTER TABLE `', p_table_name,
      '` ADD COLUMN `', p_column_name, '` ', p_column_ddl
    );
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$

CREATE PROCEDURE modify_column_if_needed(
  IN p_table_name VARCHAR(64),
  IN p_column_name VARCHAR(64),
  IN p_column_ddl TEXT
)
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = p_table_name
      AND column_name = p_column_name
  ) THEN
    SET @ddl = CONCAT(
      'ALTER TABLE `', p_table_name,
      '` MODIFY COLUMN `', p_column_name, '` ', p_column_ddl
    );
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  ELSE
    SET @ddl = CONCAT(
      'ALTER TABLE `', p_table_name,
      '` ADD COLUMN `', p_column_name, '` ', p_column_ddl
    );
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$

CREATE PROCEDURE add_index_if_missing(
  IN p_table_name VARCHAR(64),
  IN p_index_name VARCHAR(64),
  IN p_index_columns TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = p_table_name
      AND index_name = p_index_name
  ) THEN
    SET @ddl = CONCAT(
      'ALTER TABLE `', p_table_name,
      '` ADD INDEX `', p_index_name, '` (', p_index_columns, ')'
    );
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$

DELIMITER ;

-- ------------------------------------------------------------
-- 1) users: teléfono, fin de contrato, seguridad login
-- ------------------------------------------------------------
CALL add_column_if_missing('users', 'telefono', 'VARCHAR(40) NULL AFTER `num_documento`');
CALL add_column_if_missing('users', 'fecha_fin_contrato', 'DATE NULL AFTER `telefono`');
CALL add_column_if_missing('users', 'bandejas', 'JSON NULL AFTER `activo`');
CALL add_column_if_missing('users', 'accesos_profesionales', 'JSON NULL AFTER `bandejas`');
CALL add_column_if_missing('users', 'must_change_password', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER `accesos_profesionales`');
CALL add_column_if_missing('users', 'failed_login_attempts', 'INT NOT NULL DEFAULT 0 AFTER `must_change_password`');
CALL add_column_if_missing('users', 'lock_level', 'TINYINT NOT NULL DEFAULT 0 AFTER `failed_login_attempts`');
CALL add_column_if_missing('users', 'locked_until', 'DATETIME NULL AFTER `lock_level`');
CALL add_column_if_missing('users', 'is_locked', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER `locked_until`');

CALL add_index_if_missing('users', 'idx_users_ips_id', '`ips_id`');
CALL add_index_if_missing('users', 'idx_users_ips_nombre', '`ips_id`, `nombre`');
CALL add_index_if_missing('users', 'idx_users_cargo_activo', '`cargo`, `activo`');
CALL add_index_if_missing('users', 'idx_users_fecha_fin_contrato', '`fecha_fin_contrato`');

-- ------------------------------------------------------------
-- 2) encuestas: higienista oral
-- ------------------------------------------------------------
CALL add_column_if_missing('encuestas', 'id_higienista_oral_atiende', 'VARCHAR(36) NULL AFTER `id_nutricionista_atiende`');
CALL add_column_if_missing('encuestas', 'status_gest_higienista_oral', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER `status_gest_nutricionista`');
CALL add_column_if_missing('encuestas', 'fecha_gest_higienista_oral', 'DATETIME NULL AFTER `fecha_gest_nutricionista`');

CALL add_index_if_missing('encuestas', 'idx_encuestas_id_higienista_oral_atiende', '`id_higienista_oral_atiende`');
CALL add_index_if_missing('encuestas', 'idx_encuestas_higienista_oral_bandeja', '`id_higienista_oral_atiende`, `status_gest_aux`, `status_gest_higienista_oral`');
CALL add_index_if_missing('encuestas', 'idx_encuestas_fact_higienista_oral', '`id_higienista_oral_atiende`, `status_facturacion`, `fecha_facturacion`');

-- ------------------------------------------------------------
-- 3) encuestas: datos adicionales del paciente
-- ------------------------------------------------------------
CALL add_column_if_missing('encuestas', 'departamento_nacimiento', 'VARCHAR(120) NULL AFTER `sexo`');
CALL add_column_if_missing('encuestas', 'municipio_nacimiento', 'VARCHAR(120) NULL AFTER `departamento_nacimiento`');
CALL add_column_if_missing('encuestas', 'identidad_genero', 'VARCHAR(120) NULL AFTER `municipio_nacimiento`');
CALL add_column_if_missing('encuestas', 'ocupacion', 'VARCHAR(255) NULL AFTER `identidad_genero`');
CALL add_column_if_missing('encuestas', 'nivel_ocupacion', 'VARCHAR(255) NULL AFTER `ocupacion`');

CALL modify_column_if_needed('encuestas', 'identidad_genero', 'VARCHAR(120) NULL');
CALL modify_column_if_needed('encuestas', 'ocupacion', 'VARCHAR(255) NULL');
CALL modify_column_if_needed('encuestas', 'nivel_ocupacion', 'VARCHAR(255) NULL');

-- ------------------------------------------------------------
-- 4) facturadores: normalizar grupo a 'F' y limpiar delegados
-- ------------------------------------------------------------
UPDATE users
SET grupo = 'F'
WHERE LOWER(TRIM(cargo)) IN ('fact', 'facturador')
  AND (
    grupo IS NULL
    OR TRIM(grupo) = ''
    OR LOWER(TRIM(grupo)) = 'todos'
  );

UPDATE users
SET accesos_profesionales = JSON_ARRAY()
WHERE LOWER(TRIM(cargo)) IN ('fact', 'facturador')
  AND accesos_profesionales IS NOT NULL
  AND JSON_LENGTH(accesos_profesionales) > 0;

-- ------------------------------------------------------------
-- 5) índices de rendimiento (bandejas / facturación / consultas)
-- ------------------------------------------------------------
CALL add_index_if_missing('encuestas', 'idx_encuestas_numdoc', '`numdoc`');
CALL add_index_if_missing('encuestas', 'idx_encuestas_ips_id', '`ips_id`');
CALL add_index_if_missing('encuestas', 'idx_encuestas_fecha', '`fecha`');
CALL add_index_if_missing('encuestas', 'idx_encuestas_fecha_visita', '`fecha_visita`');
CALL add_index_if_missing('encuestas', 'idx_encuestas_status_visita', '`status_visita`');
CALL add_index_if_missing('encuestas', 'idx_encuestas_status_facturacion', '`status_facturacion`');
CALL add_index_if_missing('encuestas', 'idx_encuestas_id_encuestador', '`id_encuestador`');
CALL add_index_if_missing('encuestas', 'idx_encuestas_id_nutricionista_atiende', '`id_nutricionista_atiende`');
CALL add_index_if_missing('encuestas', 'idx_encuestas_created_at', '`created_at`');
CALL add_index_if_missing('encuestas', 'idx_encuestas_aux_bandeja', '`id_encuestador`, `status_gest_aux`, `status_visita`');
CALL add_index_if_missing('encuestas', 'idx_encuestas_medico_bandeja', '`id_medico_atiende`, `status_gest_aux`, `status_gest_medica`');
CALL add_index_if_missing('encuestas', 'idx_encuestas_enfermero_bandeja', '`id_enfermero_atiende`, `status_gest_aux`, `status_gest_enfermera`');
CALL add_index_if_missing('encuestas', 'idx_encuestas_psicologo_bandeja', '`id_psicologo_atiende`, `status_gest_aux`, `status_gest_psicologo`');
CALL add_index_if_missing('encuestas', 'idx_encuestas_tsocial_bandeja', '`id_tsocial_atiende`, `status_gest_aux`, `status_gest_tsocial`');
CALL add_index_if_missing('encuestas', 'idx_encuestas_nutricionista_bandeja', '`id_nutricionista_atiende`, `status_gest_aux`, `status_gest_nutricionista`');
CALL add_index_if_missing('encuestas', 'idx_encuestas_convenio_fecha', '`convenio`, `fecha`');
CALL add_index_if_missing('encuestas', 'idx_encuestas_numdoc_tipodoc', '`numdoc`, `tipodoc`');
CALL add_index_if_missing('encuestas', 'idx_encuestas_ips_fecha', '`ips_id`, `fecha`');
CALL add_index_if_missing('encuestas', 'idx_encuestas_ips_created_at', '`ips_id`, `created_at`');
CALL add_index_if_missing('encuestas', 'idx_encuestas_fact_aprov', '`convenio`, `status_facturacion`, `asig_fact`, `fecha_gest_enfermera`');
CALL add_index_if_missing('encuestas', 'idx_encuestas_facturador_pendientes', '`asig_fact`, `status_facturacion`, `fecha_facturacion`');
CALL add_index_if_missing('encuestas', 'idx_encuestas_fact_ips_fecha', '`ips_id`, `status_facturacion`, `fecha_facturacion`');
CALL add_index_if_missing('encuestas', 'idx_encuestas_fact_aux', '`id_encuestador`, `status_facturacion`, `fecha_facturacion`');
CALL add_index_if_missing('encuestas', 'idx_encuestas_fact_medico', '`id_medico_atiende`, `status_facturacion`, `fecha_facturacion`');
CALL add_index_if_missing('encuestas', 'idx_encuestas_fact_enfermero', '`id_enfermero_atiende`, `status_facturacion`, `fecha_facturacion`');
CALL add_index_if_missing('encuestas', 'idx_encuestas_fact_psicologo', '`id_psicologo_atiende`, `status_facturacion`, `fecha_facturacion`');
CALL add_index_if_missing('encuestas', 'idx_encuestas_fact_tsocial', '`id_tsocial_atiende`, `status_facturacion`, `fecha_facturacion`');
CALL add_index_if_missing('encuestas', 'idx_encuestas_fact_nutricionista', '`id_nutricionista_atiende`, `status_facturacion`, `fecha_facturacion`');

CALL add_index_if_missing('encuesta_actividades', 'idx_encuesta_actividades_encuesta_ips', '`encuesta_id`, `ips_id`');

CALL add_index_if_missing('asignacion_cups', 'idx_asignacion_cups_encuesta_actividad', '`encuesta_id`, `actividad_id`');
CALL add_index_if_missing('asignacion_cups', 'idx_asignacion_cups_encuesta_fact_key', '`encuesta_id`, `facturado`, `key_ref`');
CALL add_index_if_missing('asignacion_cups', 'idx_asignacion_cups_fact_prof', '`fact_prof`, `facturado`, `encuesta_id`');
CALL add_index_if_missing('asignacion_cups', 'idx_asignacion_cups_fact_estado', '`encuesta_id`, `facturado`, `fact_num`');
CALL add_index_if_missing('asignacion_cups', 'idx_asignacion_cups_key_fact', '`key_ref`, `facturado`, `encuesta_id`');

-- ------------------------------------------------------------
-- 6) índices para mantenimiento BD (huérfanos sin caracterización)
--    UNIQUE encuesta_id en caracterizacion ya sirve al LEFT JOIN.
-- ------------------------------------------------------------
CALL add_index_if_missing('caracterizacion', 'idx_caracterizacion_ips_id', '`ips_id`');
-- uq_caracterizacion_encuesta suele existir; si no, crear índice no-único de apoyo
CALL add_index_if_missing('caracterizacion', 'idx_caracterizacion_encuesta_id', '`encuesta_id`');

-- Limpieza
DROP PROCEDURE IF EXISTS add_column_if_missing;
DROP PROCEDURE IF EXISTS modify_column_if_needed;
DROP PROCEDURE IF EXISTS add_index_if_missing;

SELECT 'Migración pendiente pre-push aplicada correctamente' AS resultado;
