-- ============================================================
-- Migración: Facturación + BDS_EPS
-- Ejecutar en consola MySQL sobre la BD de Extramurapp.
--
-- Ejemplo:
--   mysql -u root -p extramurapp < sql/migrate-facturacion-eps-bd.sql
--
-- Los cambios solo de frontend (reactivo, orden Facturable)
-- NO requieren cambios en la base de datos.
-- ============================================================

USE extramurapp;

-- ------------------------------------------------------------
-- 1) BDS_EPS: tablas nuevas
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS eps_bd (
  id VARCHAR(36) PRIMARY KEY,
  nombre VARCHAR(190) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_eps_bd_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS eps_bd_registros (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  eps_bd_id VARCHAR(36) NOT NULL,
  tipo_documento VARCHAR(20) NOT NULL,
  numdoc VARCHAR(40) NOT NULL,
  nombre1 VARCHAR(120) NOT NULL,
  apellido1 VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_eps_bd_registros_eps (eps_bd_id),
  INDEX idx_eps_bd_registros_numdoc (numdoc),
  INDEX idx_eps_bd_registros_doc (tipo_documento, numdoc),
  CONSTRAINT fk_eps_bd_registros_eps
    FOREIGN KEY (eps_bd_id) REFERENCES eps_bd(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 2) encuestas: columnas usadas por facturación / depuración
--    (solo si aún no existen en instalaciones antiguas)
-- ------------------------------------------------------------
SET @db := DATABASE();

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'encuestas' AND COLUMN_NAME = 'status_facturacion') = 0,
  'ALTER TABLE encuestas ADD COLUMN status_facturacion TINYINT(1) NOT NULL DEFAULT 0',
  'SELECT ''OK encuestas.status_facturacion'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'encuestas' AND COLUMN_NAME = 'fecha_facturacion') = 0,
  'ALTER TABLE encuestas ADD COLUMN fecha_facturacion DATETIME NULL',
  'SELECT ''OK encuestas.fecha_facturacion'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'encuestas' AND COLUMN_NAME = 'asig_fact') = 0,
  'ALTER TABLE encuestas ADD COLUMN asig_fact VARCHAR(36) NULL',
  'SELECT ''OK encuestas.asig_fact'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ------------------------------------------------------------
-- 3) asignacion_cups: columnas de números de factura
-- ------------------------------------------------------------
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'asignacion_cups' AND COLUMN_NAME = 'fact_num') = 0,
  'ALTER TABLE asignacion_cups ADD COLUMN fact_num VARCHAR(80) NULL',
  'SELECT ''OK asignacion_cups.fact_num'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'asignacion_cups' AND COLUMN_NAME = 'fact_prof') = 0,
  'ALTER TABLE asignacion_cups ADD COLUMN fact_prof VARCHAR(36) NULL',
  'SELECT ''OK asignacion_cups.fact_prof'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'asignacion_cups' AND COLUMN_NAME = 'facturado') = 0,
  'ALTER TABLE asignacion_cups ADD COLUMN facturado TINYINT(1) NULL',
  'SELECT ''OK asignacion_cups.facturado'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'asignacion_cups' AND COLUMN_NAME = 'fecha_facturacion') = 0,
  'ALTER TABLE asignacion_cups ADD COLUMN fecha_facturacion DATETIME NULL',
  'SELECT ''OK asignacion_cups.fecha_facturacion'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ------------------------------------------------------------
-- 4) Índices recomendados (ignorar error si ya existen)
-- ------------------------------------------------------------
-- Nota: si un índice ya existe, MySQL devolverá error 1061; puede ignorarse.

SELECT 'Migración facturación + BDS_EPS finalizada' AS resultado;
