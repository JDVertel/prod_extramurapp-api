CREATE TABLE IF NOT EXISTS caracterizacion (
  id VARCHAR(36) PRIMARY KEY,
 ips_id VARCHAR(36) NULL,
  encuesta_id VARCHAR(36) NOT NULL,
  convenio VARCHAR(120) NULL,
  visita VARCHAR(60) NULL,
  tipo_visita VARCHAR(60) NULL,
  tipo_vivienda VARCHAR(60) NULL,
  estado VARCHAR(60) NULL,

  -- Condiciones del hogar
  est_iluminacion VARCHAR(30) NULL,
  est_ventilacion VARCHAR(30) NULL,
  est_paredes VARCHAR(30) NULL,
  est_pisos VARCHAR(30) NULL,
  est_techo VARCHAR(30) NULL,

  -- Signos vitales
  peso DECIMAL(5,2) NULL,
  talla DECIMAL(5,2) NULL,
  tension_sistolica DECIMAL(5,2) NULL,
  tension_diastolica DECIMAL(5,2) NULL,
  perimetro_abdominal DECIMAL(5,2) NULL,
  perimetro_branquial DECIMAL(5,2) NULL,
  oximetria DECIMAL(5,2) NULL,
  temperatura DECIMAL(5,2) NULL,
  imc DECIMAL(5,2) NULL,
  clasificacion_imc VARCHAR(60) NULL,

  -- ValoraciÃ³n ocular y vacunal
  o_izquierdo VARCHAR(30) NULL,
  o_derecho VARCHAR(30) NULL,
  evacunal VARCHAR(60) NULL,

  -- Campos con mÃºltiples selecciones (JSON arrays)
  serv_publicos JSON NULL,
  factores_riesgo JSON NULL,
  presencia_animales JSON NULL,
  antecedentes JSON NULL,
  grupo_familiar JSON NULL,
  riesgos JSON NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_caracterizacion_ips_id (ips_id),
  UNIQUE KEY uq_caracterizacion_encuesta (encuesta_id),
  CONSTRAINT fk_carac_encuesta FOREIGN KEY (encuesta_id) REFERENCES encuestas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;






