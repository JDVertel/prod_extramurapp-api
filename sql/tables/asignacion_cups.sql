CREATE TABLE IF NOT EXISTS asignacion_cups (
  id VARCHAR(36) PRIMARY KEY,
 ips_id VARCHAR(36) NULL,
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
  INDEX idx_asignacion_cups_ips_id (ips_id),
  INDEX idx_asignacion_cups_encuesta (encuesta_id),
  INDEX idx_asignacion_cups_actividad (actividad_id),
  INDEX idx_asignacion_cups_cups (cups_id),
  UNIQUE KEY uq_asignacion_cups (encuesta_id, cups_id, actividad_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;






