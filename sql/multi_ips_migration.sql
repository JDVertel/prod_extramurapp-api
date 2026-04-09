USE extramurapp;

DROP PROCEDURE IF EXISTS add_column_if_missing;
DROP PROCEDURE IF EXISTS add_index_if_missing;

DELIMITER $$
CREATE PROCEDURE add_column_if_missing(
  IN p_table VARCHAR(64),
  IN p_column VARCHAR(64),
  IN p_definition VARCHAR(255),
  IN p_after VARCHAR(64)
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table
      AND COLUMN_NAME = p_column
  ) THEN
    SET @sql = CONCAT(
      'ALTER TABLE `', p_table,
      '` ADD COLUMN `', p_column,
      '` ', p_definition,
      IF(p_after IS NULL OR p_after = '', '', CONCAT(' AFTER `', p_after, '`'))
    );
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$

CREATE PROCEDURE add_index_if_missing(
  IN p_table VARCHAR(64),
  IN p_index VARCHAR(64),
  IN p_column VARCHAR(64)
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table
      AND INDEX_NAME = p_index
  ) THEN
    SET @sql = CONCAT(
      'ALTER TABLE `', p_table,
      '` ADD INDEX `', p_index,
      '` (`', p_column, '`)'
    );
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$
DELIMITER ;

CALL add_column_if_missing('users', 'ips_id', 'VARCHAR(36) NULL', 'cargo');
CALL add_index_if_missing('users', 'idx_users_ips_id', 'ips_id');

CALL add_column_if_missing('comunas_barrios', 'ips_id', 'VARCHAR(36) NULL', 'id');
CALL add_index_if_missing('comunas_barrios', 'idx_comunas_barrios_ips_id', 'ips_id');

CALL add_column_if_missing('eps', 'ips_id', 'VARCHAR(36) NULL', 'id');
CALL add_index_if_missing('eps', 'idx_eps_ips_id', 'ips_id');

CALL add_column_if_missing('encuestas', 'ips_id', 'VARCHAR(36) NULL', 'tiporegistro');
CALL add_index_if_missing('encuestas', 'idx_encuestas_ips_id', 'ips_id');

CALL add_column_if_missing('encuesta_actividades', 'ips_id', 'VARCHAR(36) NULL', 'encuesta_id');
CALL add_index_if_missing('encuesta_actividades', 'idx_encuesta_actividades_ips_id', 'ips_id');

CALL add_column_if_missing('asignaciones', 'ips_id', 'VARCHAR(36) NULL', 'encuesta_id');
CALL add_index_if_missing('asignaciones', 'idx_asignaciones_ips_id', 'ips_id');

CALL add_column_if_missing('asignacion_cups', 'ips_id', 'VARCHAR(36) NULL', 'id');
CALL add_index_if_missing('asignacion_cups', 'idx_asignacion_cups_ips_id', 'ips_id');

CALL add_column_if_missing('agendas', 'ips_id', 'VARCHAR(36) NULL', 'id');
CALL add_index_if_missing('agendas', 'idx_agendas_ips_id', 'ips_id');

CALL add_column_if_missing('caracterizacion', 'ips_id', 'VARCHAR(36) NULL', 'id');
CALL add_index_if_missing('caracterizacion', 'idx_caracterizacion_ips_id', 'ips_id');

CALL add_column_if_missing('cups', 'ips_id', 'VARCHAR(36) NULL', 'id');
CALL add_index_if_missing('cups', 'idx_cups_ips_id', 'ips_id');

CALL add_column_if_missing('actividades_extra', 'ips_id', 'VARCHAR(36) NULL', 'id');
CALL add_index_if_missing('actividades_extra', 'idx_actividades_extra_ips_id', 'ips_id');

CALL add_column_if_missing('contratos', 'ips_id', 'VARCHAR(36) NULL', 'id');
CALL add_index_if_missing('contratos', 'idx_contratos_ips_id', 'ips_id');

CALL add_column_if_missing('contrato_cups', 'ips_id', 'VARCHAR(36) NULL', 'id');
CALL add_index_if_missing('contrato_cups', 'idx_contrato_cups_ips_id', 'ips_id');

DROP PROCEDURE IF EXISTS add_column_if_missing;
DROP PROCEDURE IF EXISTS add_index_if_missing;

SET @first_ips_id := (
  SELECT id
  FROM ips
  ORDER BY id ASC
  LIMIT 1
);

-- Backfill para no perder datos actuales.
-- Si existe al menos una IPS, completa ips_id con la primera IPS cuando esten nulos.
UPDATE users
SET
  ips_id = COALESCE(ips_id, @first_ips_id)
WHERE @first_ips_id IS NOT NULL AND ips_id IS NULL;

UPDATE comunas_barrios
SET
  ips_id = COALESCE(ips_id, @first_ips_id)
WHERE @first_ips_id IS NOT NULL AND ips_id IS NULL;

UPDATE eps
SET
  ips_id = COALESCE(ips_id, @first_ips_id)
WHERE @first_ips_id IS NOT NULL AND ips_id IS NULL;

UPDATE encuestas
SET
  ips_id = COALESCE(ips_id, @first_ips_id)
WHERE @first_ips_id IS NOT NULL AND ips_id IS NULL;

UPDATE encuesta_actividades
SET
  ips_id = COALESCE(ips_id, @first_ips_id)
WHERE @first_ips_id IS NOT NULL AND ips_id IS NULL;

UPDATE asignaciones
SET
  ips_id = COALESCE(ips_id, @first_ips_id)
WHERE @first_ips_id IS NOT NULL AND ips_id IS NULL;

UPDATE asignacion_cups
SET
  ips_id = COALESCE(ips_id, @first_ips_id)
WHERE @first_ips_id IS NOT NULL AND ips_id IS NULL;

UPDATE agendas
SET
  ips_id = COALESCE(ips_id, @first_ips_id)
WHERE @first_ips_id IS NOT NULL AND ips_id IS NULL;

UPDATE caracterizacion
SET
  ips_id = COALESCE(ips_id, @first_ips_id)
WHERE @first_ips_id IS NOT NULL AND ips_id IS NULL;

UPDATE cups
SET
  ips_id = COALESCE(ips_id, @first_ips_id)
WHERE @first_ips_id IS NOT NULL AND ips_id IS NULL;

UPDATE actividades_extra
SET
  ips_id = COALESCE(ips_id, @first_ips_id)
WHERE @first_ips_id IS NOT NULL AND ips_id IS NULL;

UPDATE contratos
SET
  ips_id = COALESCE(ips_id, @first_ips_id)
WHERE @first_ips_id IS NOT NULL AND ips_id IS NULL;

UPDATE contrato_cups
SET
  ips_id = COALESCE(ips_id, @first_ips_id)
WHERE @first_ips_id IS NOT NULL AND ips_id IS NULL;

