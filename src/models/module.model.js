export const MODULES = {
  encuestas: {
    table: "encuestas",
    pk: "id",
    columns: [
      "id",
      "tiporegistro",
      "ips_id",
      "id_encuestador",
      "id_medico_atiende",
      "id_enfermero_atiende",
      "id_psicologo_atiende",
      "id_tsocial_atiende",
      "convenio",
      "eps",
      "regimen",
      "grupo",
      "id_encuesta",
      "nombre1",
      "nombre2",
      "apellido1",
      "apellido2",
      "tipodoc",
      "numdoc",
      "sexo",
      "fecha_nac",
      "direccion",
      "telefono",
      "barrio_vereda_comuna",
      "desplazamiento",
      "poblacion_riesgo",
      "requiere_remision",
      "fecha",
      "fecha_visita",
      "status_gest_aux",
      "status_gest_medica",
      "status_gest_enfermera",
      "status_gest_psicologo",
      "status_gest_tsocial",
      "status_visita",
      "status_caracterizacion",
      "status_facturacion",
      "fecha_gest_enfermera",
      "fecha_gest_medica",
      "fecha_gest_psicologo",
      "fecha_gest_tsocial",
      "fecha_gest_auxiliar",
      "fecha_facturacion",
      "asig_fact",
      "agenda_tomamuestra",
      "agenda_visita_medica",
      "created_at",
      "updated_at",
    ],
    jsonColumns: ["agenda_tomamuestra", "agenda_visita_medica"],
    maxLengths: {
      tiporegistro: 60,
      ips_id: 36,
      id_encuestador: 36,
      id_medico_atiende: 36,
      id_enfermero_atiende: 36,
      id_psicologo_atiende: 36,
      id_tsocial_atiende: 36,
      convenio: 120,
      eps: 120,
      regimen: 60,
      grupo: 30,
      id_encuesta: 60,
      nombre1: 80,
      nombre2: 80,
      apellido1: 80,
      apellido2: 80,
      tipodoc: 20,
      numdoc: 40,
      sexo: 20,
      direccion: 255,
      telefono: 30,
      barrio_vereda_comuna: 120,
      desplazamiento: 10,
      poblacion_riesgo: 100,
      requiere_remision: 10,
      asig_fact: 36,
    },
    aliases: {
      ipsId: "ips_id",
      idEncuestador: "id_encuestador",
      idMedicoAtiende: "id_medico_atiende",
      idEnfermeroAtiende: "id_enfermero_atiende",
      idPsicologoAtiende: "id_psicologo_atiende",
      idTsocialAtiende: "id_tsocial_atiende",
      idEncuesta: "id_encuesta",
      fechaNac: "fecha_nac",
      barrioVeredacomuna: "barrio_vereda_comuna",
      poblacionRiesgo: "poblacion_riesgo",
      requiereRemision: "requiere_remision",
      fechavisita: "fecha_visita",
      fechagestEnfermera: "fecha_gest_enfermera",
      fechagestMedica: "fecha_gest_medica",
      fechagestPsicologo: "fecha_gest_psicologo",
      fechagestTsocial: "fecha_gest_tsocial",
      fechagestAuxiliar: "fecha_gest_auxiliar",
      agendaTomamuestra: "agenda_tomamuestra",
      agendaVisitaMedica: "agenda_visita_medica",
      // Aliases que el store envÃ­a con capitalizaciÃ³n diferente
      Agenda_tomademuestras: "agenda_tomamuestra",
      Agenda_Visitamedica: "agenda_visita_medica",
      FechaFacturacion: "fecha_facturacion",
      fechaFacturacion: "fecha_facturacion",
    },
  },
  encuesta_actividades: {
    table: "encuesta_actividades",
    pk: "id",
    columns: ["id", "encuesta_id", "ips_id", "actividad_key"],
    aliases: {
      ipsId: "ips_id",
      encuestaId: "encuesta_id",
      actividadKey: "actividad_key",
    },
    onConflict: "IGNORE",
  },
  asignaciones: {
    table: "asignaciones",
    pk: "encuesta_id",
    columns: ["encuesta_id", "ips_id", "key_ref", "nombre_prof", "convenio", "updated_at"],
    aliases: {
      ipsId: "ips_id",
      encuestaId: "encuesta_id",
      key: "key_ref",
      nombrePtof: "nombre_prof",
      nombreProf: "nombre_prof",
    },
  },
  agendas: {
    table: "agendas",
    pk: "id",
    columns: ["id", "encuesta_id", "ips_id", "toma_muestras", "visita_medica", "fecha", "grupo", "updated_at"],
    jsonColumns: ["toma_muestras", "visita_medica"],
    aliases: {
      ipsId: "ips_id",
      encuestaId: "encuesta_id",
      tomaMuestras: "toma_muestras",
      visitaMedica: "visita_medica",
    },
  },
  caracterizacion: {
    table: "caracterizacion",
    pk: "id",
    columns: [
      "id",
      "encuesta_id",
      "ips_id",
      "convenio",
      "visita",
      "tipo_visita",
      "tipo_vivienda",
      "estado",
      "est_iluminacion",
      "est_ventilacion",
      "est_paredes",
      "est_pisos",
      "est_techo",
      "peso",
      "talla",
      "tension_sistolica",
      "tension_diastolica",
      "perimetro_abdominal",
      "perimetro_branquial",
      "oximetria",
      "temperatura",
      "imc",
      "clasificacion_imc",
      "o_izquierdo",
      "o_derecho",
      "evacunal",
      "serv_publicos",
      "factores_riesgo",
      "presencia_animales",
      "antecedentes",
      "grupo_familiar",
      "riesgos",
      "created_at",
    ],
    jsonColumns: ["serv_publicos", "factores_riesgo", "presencia_animales", "antecedentes", "grupo_familiar", "riesgos"],
    onConflict: "UPDATE_BY_UNIQUE",
    uniqueKey: "encuesta_id",
    aliases: {
      ipsId: "ips_id",
      idEncuesta: "encuesta_id",
      encuestaId: "encuesta_id",
      tipoVisita: "tipo_visita",
      tipoVivienda: "tipo_vivienda",
      estIluminacion: "est_iluminacion",
      estVentilacion: "est_ventilacion",
      estParedes: "est_paredes",
      estPisos: "est_pisos",
      estTecho: "est_techo",
      tensionSistolica: "tension_sistolica",
      tensionDiastolica: "tension_diastolica",
      perimetroAbdominal: "perimetro_abdominal",
      perimetroBranquial: "perimetro_branquial",
      clasificacionImc: "clasificacion_imc",
      oIzquierdo: "o_izquierdo",
      oDerecho: "o_derecho",
      servPublicos: "serv_publicos",
      factoresRiesgo: "factores_riesgo",
      presenciaAnimales: "presencia_animales",
      grupoFamiliar: "grupo_familiar",
    },
  },
  comunas_barrios: {
    table: "comunas_barrios",
    pk: "id",
    columns: ["id", "ips_id", "comuna", "barrio"],
    aliases: {
      ipsId: "ips_id",
    },
  },
  eps: {
    table: "eps",
    pk: "id",
    columns: ["id", "ips_id", "eps"],
    aliases: {
      ipsId: "ips_id",
    },
  },
  ips: {
    table: "ips",
    pk: "id",
    columns: ["id", "nombre", "nit", "cod_hab", "dpto", "municipio"],
    aliases: {
      codHab: "cod_hab",
      cod_hab: "cod_hab",
    },
  },
  cups: {
    table: "cups",
    pk: "id",
    columns: ["id", "ips_id", "codigo", "descripcion_cup", "profesional", "grupo", "roles", "eps_ids"],
    jsonColumns: ["roles", "eps_ids"],
    aliases: {
      ipsId: "ips_id",
    },
  },
  actividades_extra: {
    table: "actividades_extra",
    pk: "id",
    columns: ["id", "ips_id", "clave", "nombre", "descripcion", "profesionales"],
    jsonColumns: ["profesionales"],
    aliases: {
      ipsId: "ips_id",
    },
  },
  contratos: {
    table: "contratos",
    pk: "id",
    columns: ["id", "ips_id", "eps_id", "eps_nombre", "fecha_creacion"],
    aliases: {
      ipsId: "ips_id",
      epsId: "eps_id",
      epsNombre: "eps_nombre",
      fechaCreacion: "fecha_creacion",
    },
  },
};

export function parseJsonValue(value) {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function normalizeModulePayload(payload, aliases = {}) {
  const normalized = {};
  Object.entries(payload || {}).forEach(([key, value]) => {
    normalized[aliases[key] || key] = value;
  });
  return normalized;
}

export function prepareModuleValue(column, value, jsonColumns = [], maxLengths = {}) {
  if (value === undefined) {
    return undefined;
  }

  // Evita errores en MySQL estricto (ej: DECIMAL con '')
  if (typeof value === "string" && value.trim() === "") {
    return null;
  }

  if (jsonColumns.includes(column)) {
    if (value === null) {
      return null;
    }
    return JSON.stringify(value);
  }

  // Evita que mysql2 expanda arrays en columnas no-JSON (rompe el conteo de valores)
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item ?? "").trim())
      .filter(Boolean)
      .join(", ");
  }

  // Si llega un objeto en una columna escalar, persistirlo como texto JSON
  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  if (typeof value === "string") {
    const maxLen = Number(maxLengths?.[column] || 0);
    if (maxLen > 0 && value.length > maxLen) {
      return value.slice(0, maxLen);
    }
  }

  return value;
}

export function toModuleRow(row, config) {
  if (!row) {
    return row;
  }

  const out = { ...row };
  (config.jsonColumns || []).forEach((col) => {
    out[col] = parseJsonValue(out[col]);
  });
  return out;
}
