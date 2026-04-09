USE extramurapp;

-- Tabla principal de encuestas
CREATE TABLE IF NOT EXISTS encuestas (
  id VARCHAR(36) PRIMARY KEY,
  tiporegistro VARCHAR(60) NULL,

  -- Personal asignado
  id_encuestador VARCHAR(36) NULL,
  id_medico_atiende VARCHAR(36) NULL,
  id_enfermero_atiende VARCHAR(36) NULL,
  id_psicologo_atiende VARCHAR(36) NULL,
  id_tsocial_atiende VARCHAR(36) NULL,

  -- Datos del convenio/paciente
  convenio VARCHAR(120) NULL,
  eps VARCHAR(120) NULL,
  regimen VARCHAR(60) NULL,
  grupo VARCHAR(30) NULL,
  id_encuesta VARCHAR(60) NULL,
  nombre1 VARCHAR(80) NULL,
  nombre2 VARCHAR(80) NULL,
  apellido1 VARCHAR(80) NULL,
  apellido2 VARCHAR(80) NULL,
  tipodoc VARCHAR(20) NULL,
  numdoc VARCHAR(40) NULL,
  sexo VARCHAR(20) NULL,
  fecha_nac DATE NULL,
  direccion VARCHAR(255) NULL,
  telefono VARCHAR(30) NULL,
  barrio_vereda_comuna VARCHAR(120) NULL,
  desplazamiento VARCHAR(10) NULL,
  poblacion_riesgo TEXT NULL,
  requiere_remision VARCHAR(10) NULL,

  -- Fechas
  fecha DATE NULL,
  fecha_visita DATE NULL,

  -- Estados
  status_gest_aux TINYINT(1) NOT NULL DEFAULT 0,
  status_gest_medica TINYINT(1) NOT NULL DEFAULT 0,
  status_gest_enfermera TINYINT(1) NOT NULL DEFAULT 0,
  status_gest_psicologo TINYINT(1) NOT NULL DEFAULT 0,
  status_gest_tsocial TINYINT(1) NOT NULL DEFAULT 0,
  status_visita TINYINT(1) NOT NULL DEFAULT 0,
  status_caracterizacion TINYINT(1) NOT NULL DEFAULT 0,
  status_facturacion TINYINT(1) NOT NULL DEFAULT 0,

  -- Fechas de cierre
  fecha_gest_enfermera DATETIME NULL,
  fecha_gest_medica DATETIME NULL,
  fecha_gest_psicologo DATETIME NULL,
  fecha_gest_tsocial DATETIME NULL,
  fecha_gest_auxiliar DATETIME NULL,
  fecha_facturacion DATETIME NULL,

  -- Facturación
  asig_fact VARCHAR(36) NULL,

  -- Agenda
  agenda_tomamuestra JSON NULL,
  agenda_visita_medica JSON NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_encuestas_numdoc (numdoc),
  INDEX idx_encuestas_fecha_visita (fecha_visita),
  INDEX idx_encuestas_status_visita (status_visita),
  INDEX idx_encuestas_status_facturacion (status_facturacion),
  INDEX idx_encuestas_id_encuestador (id_encuestador),
  INDEX idx_encuestas_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Actividades asociadas a la encuesta
CREATE TABLE IF NOT EXISTS encuesta_actividades (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  encuesta_id VARCHAR(36) NOT NULL,
  actividad_key VARCHAR(60) NOT NULL,
  UNIQUE KEY uq_encuesta_actividad (encuesta_id, actividad_key),
  CONSTRAINT fk_encuesta_actividades_encuesta FOREIGN KEY (encuesta_id)
    REFERENCES encuestas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
