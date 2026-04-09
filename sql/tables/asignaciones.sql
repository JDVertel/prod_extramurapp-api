CREATE TABLE IF NOT EXISTS asignaciones (
  encuesta_id VARCHAR(36) PRIMARY KEY,
 ips_id VARCHAR(36) NULL,
  key_ref VARCHAR(100) NULL,
  nombre_prof VARCHAR(190) NULL,
  convenio VARCHAR(120) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_asignaciones_ips_id (ips_id),
  CONSTRAINT fk_asig_encuesta FOREIGN KEY (encuesta_id) REFERENCES encuestas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;






