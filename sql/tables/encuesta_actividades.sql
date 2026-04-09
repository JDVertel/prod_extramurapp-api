CREATE TABLE IF NOT EXISTS encuesta_actividades (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
 ips_id VARCHAR(36) NULL,
  encuesta_id VARCHAR(36) NOT NULL,
  actividad_key VARCHAR(60) NOT NULL,
  INDEX idx_encuesta_actividades_ips_id (ips_id),
  UNIQUE KEY uq_encuesta_actividad (encuesta_id, actividad_key),
  CONSTRAINT fk_act_encuesta FOREIGN KEY (encuesta_id) REFERENCES encuestas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;






