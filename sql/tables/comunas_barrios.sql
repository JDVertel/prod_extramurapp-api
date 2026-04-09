CREATE TABLE IF NOT EXISTS comunas_barrios (
  id VARCHAR(36) PRIMARY KEY,
  ips_id VARCHAR(36) NULL,
  comuna VARCHAR(120) NOT NULL,
  barrio VARCHAR(120) NOT NULL,
  UNIQUE KEY uq_comuna_barrio_ips (ips_id, comuna, barrio),
  INDEX idx_comunas_barrios_ips_id (ips_id),
  INDEX idx_comuna (comuna)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

