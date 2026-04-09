CREATE TABLE IF NOT EXISTS agendas (
  id VARCHAR(36) PRIMARY KEY,
 ips_id VARCHAR(36) NULL,
  encuesta_id VARCHAR(36) NULL,
  toma_muestras JSON NULL,    -- array de citas de laboratorio
  visita_medica JSON NULL,    -- array de citas de visita
  fecha DATE NULL,
  grupo VARCHAR(30) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_agendas_ips_id (ips_id),
  INDEX idx_agendas_encuesta_id (encuesta_id),
  INDEX idx_agendas_fecha (fecha),
  INDEX idx_agendas_grupo (grupo),
  CONSTRAINT fk_agendas_encuesta FOREIGN KEY (encuesta_id) REFERENCES encuestas(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;






