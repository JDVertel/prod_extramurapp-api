CREATE DATABASE IF NOT EXISTS extramurapp
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE extramurapp;
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  nombre VARCHAR(190) NOT NULL,
  cargo VARCHAR(100) NOT NULL,
 ips_id VARCHAR(36) NULL,
  convenio VARCHAR(120) NULL,
  grupo VARCHAR(30) NULL,
  num_documento VARCHAR(40) NULL UNIQUE,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  bandejas JSON NULL,
  accesos_profesionales JSON NULL,
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  failed_login_attempts INT NOT NULL DEFAULT 0,
  lock_level TINYINT NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  is_locked TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_ips_id (ips_id)
  ,INDEX idx_users_ips_nombre (ips_id, nombre)
  ,INDEX idx_users_cargo_activo (cargo, activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id VARCHAR(36) NOT NULL,
  token VARCHAR(140) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_prt_user_id (user_id),
  INDEX idx_prt_expires_at (expires_at),
  INDEX idx_prt_used_at (used_at),
  CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rt_nodes (
  path VARCHAR(512) PRIMARY KEY,
  value JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- ============================================================
-- CATÃLOGOS / PARÃMETROS
-- ============================================================

CREATE TABLE IF NOT EXISTS comunas_barrios (
  id VARCHAR(36) PRIMARY KEY,
  ips_id VARCHAR(36) NULL,
  comuna VARCHAR(120) NOT NULL,
  barrio VARCHAR(120) NOT NULL,
  UNIQUE KEY uq_comuna_barrio_ips (ips_id, comuna, barrio),
  INDEX idx_comunas_barrios_ips_id (ips_id),
  INDEX idx_comuna (comuna)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS eps (
  id VARCHAR(36) PRIMARY KEY,
  ips_id VARCHAR(36) NULL,
  eps VARCHAR(190) NOT NULL,
  UNIQUE KEY uq_eps_nombre_ips (ips_id, eps),
  INDEX idx_eps_ips_id (ips_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ips (
  id VARCHAR(36) PRIMARY KEY,
  nombre VARCHAR(190) NOT NULL,
  nit VARCHAR(60) NULL,
  cod_hab VARCHAR(80) NULL,
  dpto VARCHAR(120) NULL,
  municipio VARCHAR(120) NULL,
  logo_url MEDIUMTEXT NULL,
  color_institucional VARCHAR(20) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

-- ============================================================
-- CONTRATOS
-- ============================================================

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
  UNIQUE KEY uq_contrato_cups (contrato_id, cups_id, actividad_id),
  CONSTRAINT fk_contrato_cups_contrato FOREIGN KEY (contrato_id) REFERENCES contratos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- ENCUESTAS (registro principal de visita/paciente)
-- ============================================================

CREATE TABLE IF NOT EXISTS encuestas (
  id VARCHAR(36) PRIMARY KEY,
  tiporegistro VARCHAR(60) NULL,
 ips_id VARCHAR(36) NULL,
  -- Personal asignado
  id_encuestador VARCHAR(36) NULL,
  id_medico_atiende VARCHAR(36) NULL,
  id_enfermero_atiende VARCHAR(36) NULL,
  id_psicologo_atiende VARCHAR(36) NULL,
  id_tsocial_atiende VARCHAR(36) NULL,
  id_nutricionista_atiende VARCHAR(36) NULL,

  -- Datos del convenio
  convenio VARCHAR(120) NULL,
  eps VARCHAR(120) NULL,
  regimen VARCHAR(60) NULL,
  grupo VARCHAR(30) NULL,
  id_encuesta VARCHAR(60) NULL,

  -- Datos del paciente
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
  poblacion_riesgo VARCHAR(100) NULL,
  requiere_remision VARCHAR(10) NULL,

  -- Fechas
  fecha DATE NULL,
  fecha_visita DATE NULL,

  -- Estados de gestiÃ³n
  status_gest_aux TINYINT(1) NOT NULL DEFAULT 0,
  status_gest_medica TINYINT(1) NOT NULL DEFAULT 0,
  status_gest_enfermera TINYINT(1) NOT NULL DEFAULT 0,
  status_gest_psicologo TINYINT(1) NOT NULL DEFAULT 0,
  status_gest_tsocial TINYINT(1) NOT NULL DEFAULT 0,
  status_gest_nutricionista TINYINT(1) NOT NULL DEFAULT 0,
  status_visita TINYINT(1) NOT NULL DEFAULT 0,
  status_caracterizacion TINYINT(1) NOT NULL DEFAULT 0,
  status_facturacion TINYINT(1) NOT NULL DEFAULT 0,

  -- Fechas de cierre por rol
  fecha_gest_enfermera DATETIME NULL,
  fecha_gest_medica DATETIME NULL,
  fecha_gest_psicologo DATETIME NULL,
  fecha_gest_tsocial DATETIME NULL,
  fecha_gest_nutricionista DATETIME NULL,
  fecha_gest_auxiliar DATETIME NULL,
  fecha_facturacion DATETIME NULL,

  -- FacturaciÃ³n
  asig_fact VARCHAR(36) NULL,

  -- Agenda (guardada como JSON porque tiene estructura variable)
  agenda_tomamuestra JSON NULL,
  agenda_visita_medica JSON NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_encuestas_numdoc (numdoc),
  INDEX idx_encuestas_ips_id (ips_id),
  INDEX idx_encuestas_fecha_visita (fecha_visita),
  INDEX idx_encuestas_status_visita (status_visita),
  INDEX idx_encuestas_status_facturacion (status_facturacion),
  INDEX idx_encuestas_id_encuestador (id_encuestador),
  INDEX idx_encuestas_id_nutricionista_atiende (id_nutricionista_atiende),
  INDEX idx_encuestas_created_at (created_at),
  INDEX idx_encuestas_aux_bandeja (id_encuestador, status_gest_aux, status_visita),
  INDEX idx_encuestas_medico_bandeja (id_medico_atiende, status_gest_aux, status_gest_medica),
  INDEX idx_encuestas_enfermero_bandeja (id_enfermero_atiende, status_gest_aux, status_gest_enfermera),
  INDEX idx_encuestas_psicologo_bandeja (id_psicologo_atiende, status_gest_aux, status_gest_psicologo),
  INDEX idx_encuestas_tsocial_bandeja (id_tsocial_atiende, status_gest_aux, status_gest_tsocial),
  INDEX idx_encuestas_nutricionista_bandeja (id_nutricionista_atiende, status_gest_aux, status_gest_nutricionista),
  INDEX idx_encuestas_convenio_fecha (convenio, fecha),
  INDEX idx_encuestas_numdoc_tipodoc (numdoc, tipodoc),
  INDEX idx_encuestas_fact_aprov (convenio, status_facturacion, asig_fact, fecha_gest_enfermera),
  INDEX idx_encuestas_facturador_pendientes (asig_fact, status_facturacion, fecha_facturacion),
  INDEX idx_encuestas_fact_ips_fecha (ips_id, status_facturacion, fecha_facturacion),
  INDEX idx_encuestas_fact_aux (id_encuestador, status_facturacion, fecha_facturacion),
  INDEX idx_encuestas_fact_medico (id_medico_atiende, status_facturacion, fecha_facturacion),
  INDEX idx_encuestas_fact_enfermero (id_enfermero_atiende, status_facturacion, fecha_facturacion),
  INDEX idx_encuestas_fact_psicologo (id_psicologo_atiende, status_facturacion, fecha_facturacion),
  INDEX idx_encuestas_fact_tsocial (id_tsocial_atiende, status_facturacion, fecha_facturacion),
  INDEX idx_encuestas_fact_nutricionista (id_nutricionista_atiende, status_facturacion, fecha_facturacion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- ACTIVIDADES POR ENCUESTA
-- ============================================================

CREATE TABLE IF NOT EXISTS encuesta_actividades (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
 ips_id VARCHAR(36) NULL,
  encuesta_id VARCHAR(36) NOT NULL,
  actividad_key VARCHAR(60) NOT NULL,
  INDEX idx_encuesta_actividades_ips_id (ips_id),
  INDEX idx_encuesta_actividades_encuesta_ips (encuesta_id, ips_id),
  UNIQUE KEY uq_encuesta_actividad (encuesta_id, actividad_key),
  CONSTRAINT fk_act_encuesta FOREIGN KEY (encuesta_id) REFERENCES encuestas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- ASIGNACIONES DE CUPS POR ENCUESTA
-- (estructura compleja anidada â†’ JSON)
-- ============================================================

CREATE TABLE IF NOT EXISTS asignaciones (
  encuesta_id VARCHAR(36) PRIMARY KEY,
 ips_id VARCHAR(36) NULL,
  key_ref VARCHAR(100) NULL,
  nombre_prof VARCHAR(190) NULL,
  convenio VARCHAR(120) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_asignaciones_ips_id (ips_id),
  CONSTRAINT fk_asig_encuesta FOREIGN KEY (encuesta_id) REFERENCES encuestas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS asignacion_cups (
  id VARCHAR(36) PRIMARY KEY,
 ips_id VARCHAR(36) NULL,
  encuesta_id VARCHAR(36) NOT NULL,
  key_ref VARCHAR(100) NULL,
  nombre_prof VARCHAR(190) NULL,
  convenio VARCHAR(120) NULL,
  actividad_id VARCHAR(60) NULL,
  cups_id VARCHAR(36) NOT NULL,
  cups_nombre VARCHAR(255) NOT NULL,
  cups_codigo VARCHAR(40) NULL,
  cups_grupo VARCHAR(120) NULL,
  cantidad INT NULL,
  detalle TEXT NULL,
  fact_num VARCHAR(80) NULL,
  fact_prof VARCHAR(36) NULL,
  facturado TINYINT(1) NULL,
  fecha_facturacion DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_asignacion_cups_ips_id (ips_id),
  INDEX idx_asignacion_cups_encuesta (encuesta_id),
  INDEX idx_asignacion_cups_actividad (actividad_id),
  INDEX idx_asignacion_cups_cups (cups_id),
  INDEX idx_asignacion_cups_encuesta_actividad (encuesta_id, actividad_id),
  INDEX idx_asignacion_cups_encuesta_fact_key (encuesta_id, facturado, key_ref),
  INDEX idx_asignacion_cups_fact_prof (fact_prof, facturado, encuesta_id),
  INDEX idx_asignacion_cups_fact_estado (encuesta_id, facturado, fact_num),
  INDEX idx_asignacion_cups_key_fact (key_ref, facturado, encuesta_id),
  UNIQUE KEY uq_asignacion_cups (encuesta_id, cups_id, actividad_id),
  CONSTRAINT fk_asignacion_cups_encuesta FOREIGN KEY (encuesta_id) REFERENCES encuestas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- AGENDAS
-- ============================================================

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

-- ============================================================
-- CARACTERIZACIÃ“N
-- ============================================================

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
  detalle_sedentarismo DECIMAL(6,2) NULL,
  detalle_consumo_alcohol VARCHAR(60) NULL,
  detalle_consumo_cigarrillo DECIMAL(6,2) NULL,
  detalle_alimentacion_poco_saludable VARCHAR(255) NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_caracterizacion_ips_id (ips_id),
  UNIQUE KEY uq_caracterizacion_encuesta (encuesta_id),
  CONSTRAINT fk_carac_encuesta FOREIGN KEY (encuesta_id) REFERENCES encuestas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;





