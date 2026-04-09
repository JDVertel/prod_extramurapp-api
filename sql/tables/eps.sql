CREATE TABLE IF NOT EXISTS eps (
  id VARCHAR(36) PRIMARY KEY,
  ips_id VARCHAR(36) NULL,
  eps VARCHAR(190) NOT NULL,
  UNIQUE KEY uq_eps_nombre_ips (ips_id, eps),
  INDEX idx_eps_ips_id (ips_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

