USE extramurapp;

DROP PROCEDURE IF EXISTS add_index_if_missing;

DELIMITER $$

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
      'ALTER TABLE `',
      p_table_name,
      '` ADD INDEX `',
      p_index_name,
      '` (',
      p_index_columns,
      ')'
    );

    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$

DELIMITER ;

CALL add_index_if_missing('encuestas', 'idx_encuestas_numdoc_tipodoc', '`numdoc`, `tipodoc`');
CALL add_index_if_missing('encuestas', 'idx_encuestas_fact_aprov', '`convenio`, `status_facturacion`, `asig_fact`, `fecha_gest_enfermera`');
CALL add_index_if_missing('encuestas', 'idx_encuestas_facturador_pendientes', '`asig_fact`, `status_facturacion`, `fecha_facturacion`');
CALL add_index_if_missing('encuestas', 'idx_encuestas_fact_ips_fecha', '`ips_id`, `status_facturacion`, `fecha_facturacion`');
CALL add_index_if_missing('encuestas', 'idx_encuestas_fact_aux', '`id_encuestador`, `status_facturacion`, `fecha_facturacion`');
CALL add_index_if_missing('encuestas', 'idx_encuestas_fact_medico', '`id_medico_atiende`, `status_facturacion`, `fecha_facturacion`');
CALL add_index_if_missing('encuestas', 'idx_encuestas_fact_enfermero', '`id_enfermero_atiende`, `status_facturacion`, `fecha_facturacion`');
CALL add_index_if_missing('encuestas', 'idx_encuestas_fact_psicologo', '`id_psicologo_atiende`, `status_facturacion`, `fecha_facturacion`');
CALL add_index_if_missing('encuestas', 'idx_encuestas_fact_tsocial', '`id_tsocial_atiende`, `status_facturacion`, `fecha_facturacion`');
CALL add_index_if_missing('encuestas', 'idx_encuestas_fact_nutricionista', '`id_nutricionista_atiende`, `status_facturacion`, `fecha_facturacion`');

CALL add_index_if_missing('asignacion_cups', 'idx_asignacion_cups_encuesta_fact_key', '`encuesta_id`, `facturado`, `key_ref`');
CALL add_index_if_missing('asignacion_cups', 'idx_asignacion_cups_fact_prof', '`fact_prof`, `facturado`, `encuesta_id`');
CALL add_index_if_missing('asignacion_cups', 'idx_asignacion_cups_fact_estado', '`encuesta_id`, `facturado`, `fact_num`');
CALL add_index_if_missing('asignacion_cups', 'idx_asignacion_cups_key_fact', '`key_ref`, `facturado`, `encuesta_id`');

DROP PROCEDURE IF EXISTS add_index_if_missing;
