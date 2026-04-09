CREATE TABLE IF NOT EXISTS actividades_extra (
  id VARCHAR(36) PRIMARY KEY,
 ips_id VARCHAR(36) NULL,
  clave VARCHAR(60) NOT NULL,
  nombre VARCHAR(190) NOT NULL,
  descripcion TEXT NULL,
  profesionales JSON NULL,   -- array de strings
  UNIQUE KEY uq_actividades_extra_clave (clave),
  INDEX idx_actividades_extra_ips_id (ips_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;






