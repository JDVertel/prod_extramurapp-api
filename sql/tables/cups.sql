CREATE TABLE IF NOT EXISTS cups (
  id VARCHAR(36) PRIMARY KEY,
 ips_id VARCHAR(36) NULL,
  codigo VARCHAR(30) NOT NULL,
  descripcion_cup VARCHAR(255) NOT NULL,
  profesional VARCHAR(100) NOT NULL,
  grupo VARCHAR(60) NULL,
  roles JSON NULL,      -- array de strings
  eps_ids JSON NULL,    -- array de strings
  UNIQUE KEY uq_cups_codigo (codigo),
  INDEX idx_cups_ips_id (ips_id),
  INDEX idx_cups_profesional (profesional),
  INDEX idx_cups_grupo (grupo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;






