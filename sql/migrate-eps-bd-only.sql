-- ============================================================
-- Migración REDUCIDA: solo BDS_EPS
-- Ejecutar en consola MySQL de producción.
--
-- Cambia el nombre de la BD si no es "extramurapp":
--   USE tu_base_de_datos;
-- ============================================================

USE extramurapp;

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

SELECT 'BDS_EPS: tablas eps_bd y eps_bd_registros listas' AS resultado;
