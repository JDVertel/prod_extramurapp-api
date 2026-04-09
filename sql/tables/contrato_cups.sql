CREATE TABLE IF NOT EXISTS contrato_cups (
  id VARCHAR(36) PRIMARY KEY,
 ips_id VARCHAR(36) NULL,
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
  INDEX idx_contrato_cups_ips_id (ips_id),
  INDEX idx_contrato_cups_contrato (contrato_id),
  INDEX idx_contrato_cups_cups (cups_id),
  INDEX idx_contrato_cups_actividad (actividad_id),
  UNIQUE KEY uq_contrato_cups (contrato_id, cups_id, actividad_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;






