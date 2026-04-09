CREATE TABLE IF NOT EXISTS contratos (
  id VARCHAR(36) PRIMARY KEY,
 ips_id VARCHAR(36) NULL,
  eps_id VARCHAR(36) NULL,
  eps_nombre VARCHAR(190) NOT NULL,
  fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_contratos_ips_id (ips_id),
  INDEX idx_contratos_eps_id (eps_id),
  CONSTRAINT fk_contratos_eps FOREIGN KEY (eps_id) REFERENCES eps(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;






