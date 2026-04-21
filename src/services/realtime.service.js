import { deepMerge, getBySegments, isObject, normalizePath } from "../models/realtime.model.js";
import {
  createModule,
  getModuleById,
  listModule,
  patchModule,
  removeModule,
  replaceModule,
} from "./module.service.js";
import {
  createUserRecord,
  deleteUserRecord,
  getUserById,
  getUsers,
  updateUserPasswordRecord,
  updateUserRecord,
} from "./user.service.js";
import {
  deleteRealtimeValue as deleteStoredRealtimeValue,
  getRealtimeValue as getStoredRealtimeValue,
  patchRealtimeValue as patchStoredRealtimeValue,
  postRealtimeValue as postStoredRealtimeValue,
  putRealtimeValue as putStoredRealtimeValue,
} from "./realtime-store.service.js";

function splitPath(inputPath = "") {
  const clean = normalizePath(inputPath);
  return clean.split("/").filter(Boolean);
}

function canonicalRoot(root = "") {
  const key = String(root || "").trim().toLowerCase();

  if (key === "encuesta") return "encuesta";
  if (key === "actividades") return "actividades";
  if (key === "asignaciones") return "asignaciones";
  if (key === "caracterizacion") return "caracterizacion";
  if (key === "agendas") return "agendas";
  if (key === "comunasybarrios" || key === "comunas_barrios") return "comunasybarrios";
  if (key === "eps") return "eps";
  if (key === "contratos") return "contratos";
  if (key === "cups") return "cups";
  if (key === "ips") return "ips";
  if (key === "actividadesextra" || key === "actividades_extra") return "actividadesextra";
  if (key === "usuarios" || key === "users") return "usuarios";
  if (key === "cupsactividades") return "cupsactividades";
  return key;
}

function toRouteInfo(inputPath = "") {
  const segments = splitPath(inputPath);
  const [rootRaw, id, ...rest] = segments;
  return {
    root: canonicalRoot(rootRaw),
    id,
    rest,
  };
}

function normalizeIpsId(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function withActorIpsId(payload = {}, actor = null) {
  const source = isObject(payload) ? { ...payload } : {};
  if (source.ipsId || source.idips || source.ips_id || source.ips) {
    return source;
  }

  const actorIpsId = normalizeIpsId(actor?.ipsId ?? actor?.ips_id ?? actor?.ips);
  if (!actorIpsId) {
    return source;
  }

  return {
    ...source,
    ipsId: actorIpsId,
  };
}

function parseBarrioVeredaComuna(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    const barrio = String(value.barrio ?? value.Barrio ?? "").trim();
    const comuna = String(value.comuna ?? value.Comuna ?? "").trim();
    if (!barrio && !comuna) {
      return null;
    }

    return { barrio, comuna };
  }

  const raw = String(value).trim();
  if (!raw || raw === "[object Object]") {
    return null;
  }

  if ((raw.startsWith("{") && raw.endsWith("}")) || (raw.startsWith("[") && raw.endsWith("]"))) {
    try {
      return parseBarrioVeredaComuna(JSON.parse(raw));
    } catch {
      return { barrio: raw, comuna: "" };
    }
  }

  const groupedMatch = raw.match(/^(.*)\((.*)\)$/);
  if (groupedMatch) {
    return {
      barrio: String(groupedMatch[1] || "").trim(),
      comuna: String(groupedMatch[2] || "").trim(),
    };
  }

  return { barrio: raw, comuna: "" };
}

function serializeBarrioVeredaComuna(value) {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  if (typeof value === "string") {
    const text = value.trim();
    return text && text !== "[object Object]" ? text : undefined;
  }

  const normalized = parseBarrioVeredaComuna(value);
  return normalized ? JSON.stringify(normalized) : undefined;
}

function parsePoblacionRiesgo(value) {
  if (value === null || value === undefined || value === "") {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }

  const raw = String(value).trim();
  if (!raw || raw === "[object Object]") {
    return [];
  }

  if ((raw.startsWith("[") && raw.endsWith("]")) || (raw.startsWith("{") && raw.endsWith("}"))) {
    try {
      return parsePoblacionRiesgo(JSON.parse(raw));
    } catch {
      return raw.split(/[|,]/).map((item) => item.trim()).filter(Boolean);
    }
  }

  return raw.split(/[|,]/).map((item) => item.trim()).filter(Boolean);
}

function serializePoblacionRiesgo(value) {
  const items = parsePoblacionRiesgo(value);
  if (!items.length) {
    return undefined;
  }

  let serialized = items.join(" | ");
  if (serialized.length <= 100) {
    return serialized;
  }

  const fitted = [];
  for (const item of items) {
    const next = fitted.length ? `${fitted.join(" | ")} | ${item}` : item;
    if (next.length > 100) {
      break;
    }
    fitted.push(item);
  }

  serialized = fitted.length ? fitted.join(" | ") : items[0].slice(0, 100);
  return serialized;
}

function toBooleanStatus(value) {
  if (value === true || value === false) return value;
  if (value === 1 || value === "1") return true;
  if (value === 0 || value === "0" || value === null || value === undefined || value === "") return false;

  const raw = String(value).trim().toLowerCase();
  if (["true", "si", "sí", "yes"].includes(raw)) return true;
  if (["false", "no"].includes(raw)) return false;
  return Boolean(value);
}

function padDatePart(value) {
  return String(value).padStart(2, "0");
}

function formatLocalDate(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return undefined;
  return `${value.getFullYear()}-${padDatePart(value.getMonth() + 1)}-${padDatePart(value.getDate())}`;
}

function formatLocalDateTime(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return undefined;
  return `${formatLocalDate(value)} ${padDatePart(value.getHours())}:${padDatePart(value.getMinutes())}:${padDatePart(value.getSeconds())}`;
}

function serializeDateTimeOutput(value) {
  if (value instanceof Date) {
    return formatLocalDateTime(value);
  }
  return value;
}

function normalizeStatusGestionLevel(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "boolean") return value ? 1 : 0;

  const raw = String(value).trim().toLowerCase();
  if (!raw) return 0;
  if (["true", "si", "sí", "yes"].includes(raw)) return 1;
  if (["false", "no"].includes(raw)) return 0;

  const parsed = Number(raw);
  if (Number.isFinite(parsed)) {
    if (parsed >= 2) return 2;
    if (parsed >= 1) return 1;
    return 0;
  }

  return Boolean(value) ? 1 : 0;
}

function cleanObject(payload = {}) {
  const out = {};
  Object.entries(payload || {}).forEach(([key, value]) => {
    if (value === null && key === "asig_fact") {
      out[key] = null;
      return;
    }

    if (value === undefined || value === null) return;
    if (typeof value === "string" && value.trim() === "") return;
    out[key] = value;
  });
  return out;
}

function normalizeDateValue(value) {
  if (value === undefined || value === null) return undefined;
  if (value instanceof Date) return formatLocalDate(value);
  const raw = String(value).trim();
  if (!raw) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return formatLocalDate(parsed);
}

function normalizeDateTimeValue(value) {
  if (value === undefined || value === null) return undefined;
  if (value instanceof Date) return formatLocalDateTime(value);
  const raw = String(value).trim();
  if (!raw) return undefined;
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(raw)) {
    return raw.replace("T", " ");
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return formatLocalDateTime(parsed);
}

function toBit(value) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value ? 1 : 0;

  const raw = String(value).trim().toLowerCase();
  if (["1", "true", "si", "sí", "yes"].includes(raw)) return 1;
  if (["0", "false", "no"].includes(raw)) return 0;

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? (parsed ? 1 : 0) : undefined;
}

function toStatusGestValue(value) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value ? 1 : 0;

  const raw = String(value).trim().toLowerCase();
  if (["true", "si", "sí", "yes"].includes(raw)) return 1;
  if (["false", "no"].includes(raw)) return 0;

  const parsed = Number(raw);
  if (Number.isFinite(parsed)) {
    if (parsed >= 2) return 2;
    if (parsed >= 1) return 1;
    return 0;
  }

  return undefined;
}

function buildEncuestasMap(rows = []) {
  const out = {};
  rows.forEach((row) => {
    if (!row?.id) return;

    const barrioVeredaComuna = parseBarrioVeredaComuna(row.barrio_vereda_comuna ?? row.barrioVeredacomuna);
    out[row.id] = {
      ...row,
      idEncuestador: row.id_encuestador ?? row.idEncuestador,
      idMedicoAtiende: row.id_medico_atiende ?? row.idMedicoAtiende,
      idEnfermeroAtiende: row.id_enfermero_atiende ?? row.idEnfermeroAtiende,
      idPsicologoAtiende: row.id_psicologo_atiende ?? row.idPsicologoAtiende,
      idTsocialAtiende: row.id_tsocial_atiende ?? row.idTsocialAtiende,
      idNutricionistaAtiende: row.id_nutricionista_atiende ?? row.idNutricionistaAtiende ?? row.idNutriAtiende,
      idEncuesta: row.id_encuesta ?? row.idEncuesta,
      fechaNac: row.fecha_nac ?? row.fechaNac,
      barrioVeredacomuna: barrioVeredaComuna,
      poblacionRiesgo: parsePoblacionRiesgo(row.poblacion_riesgo ?? row.poblacionRiesgo),
      requiereRemision: row.requiere_remision ?? row.requiereRemision,
      fechavisita: serializeDateTimeOutput(row.fecha_visita ?? row.fechavisita),
      fechagestEnfermera: serializeDateTimeOutput(row.fecha_gest_enfermera ?? row.fechagestEnfermera),
      fechagestMedica: serializeDateTimeOutput(row.fecha_gest_medica ?? row.fechagestMedica),
      fechagestPsicologo: serializeDateTimeOutput(row.fecha_gest_psicologo ?? row.fechagestPsicologo),
      fechagestTsocial: serializeDateTimeOutput(row.fecha_gest_tsocial ?? row.fechagestTsocial),
      fechagestNutricionista: serializeDateTimeOutput(row.fecha_gest_nutricionista ?? row.fechagestNutricionista),
      fechagestAuxiliar: serializeDateTimeOutput(row.fecha_gest_auxiliar ?? row.fechagestAuxiliar),
      FechaFacturacion: serializeDateTimeOutput(row.fecha_facturacion ?? row.fechaFacturacion ?? row.FechaFacturacion),
      fechaFacturacion: serializeDateTimeOutput(row.fecha_facturacion ?? row.fechaFacturacion ?? row.FechaFacturacion),
      asigfact: row.asig_fact ?? row.asigfact,
      status_gest_aux: toBooleanStatus(row.status_gest_aux),
      status_gest_medica: toBooleanStatus(row.status_gest_medica),
      status_gest_enfermera: toBooleanStatus(row.status_gest_enfermera),
      status_gest_psicologo: toBooleanStatus(row.status_gest_psicologo),
      status_gest_tsocial: toBooleanStatus(row.status_gest_tsocial),
      status_gest_nutricionista: toBooleanStatus(row.status_gest_nutricionista ?? row.status_gest_nutri),
      status_gest_aux_valor: normalizeStatusGestionLevel(row.status_gest_aux),
      status_gest_medica_valor: normalizeStatusGestionLevel(row.status_gest_medica),
      status_gest_enfermera_valor: normalizeStatusGestionLevel(row.status_gest_enfermera),
      status_gest_psicologo_valor: normalizeStatusGestionLevel(row.status_gest_psicologo),
      status_gest_tsocial_valor: normalizeStatusGestionLevel(row.status_gest_tsocial),
      status_gest_nutricionista_valor: normalizeStatusGestionLevel(row.status_gest_nutricionista ?? row.status_gest_nutri),
      status_visita: toBooleanStatus(row.status_visita),
      status_caracterizacion: toBooleanStatus(row.status_caracterizacion),
      status_facturacion: toBooleanStatus(row.status_facturacion),
    };
  });
  return out;
}

function buildActividadesMap(rows = []) {
  const out = {};
  rows.forEach((row) => {
    if (!row?.encuesta_id) return;
    if (!out[row.encuesta_id]) {
      out[row.encuesta_id] = { tipoActividad: {} };
    }

    out[row.encuesta_id].tipoActividad[String(row.id)] = {
      key: row.actividad_key,
    };
  });
  return out;
}

function buildActividadesNode(rows = []) {
  const map = buildActividadesMap(rows);
  const encuestaIds = Object.keys(map);
  return encuestaIds.length ? (map[encuestaIds[0]] || null) : null;
}

function toLegacyAsignacionPayload(row = {}) {
  if (!row) return {};
  if (row.datos && typeof row.datos === "object") return row.datos;

  return {
    key: row.key ?? row.key_ref ?? null,
    nombrePtof: row.nombrePtof ?? row.nombreProf ?? row.nombre_prof ?? null,
    convenio: row.convenio ?? null,
    idEncuesta: row.idEncuesta ?? row.encuesta_id ?? null,
    cups: row.cups ?? {},
  };
}

function buildAsignacionesMap(rows = []) {
  const out = {};
  rows.forEach((row) => {
    if (row?.encuesta_id) {
      out[row.encuesta_id] = toLegacyAsignacionPayload(row);
    }
  });
  return out;
}

function buildCaracterizacionMap(rows = []) {
  const out = {};
  rows.forEach((row) => {
    if (!row?.id) return;
    out[row.id] = {
      ...row,
      idEncuesta: row.encuesta_id ?? row.idEncuesta,
      tipovisita: row.tipo_visita ?? row.tipovisita,
      tipovivienda: row.tipo_vivienda ?? row.tipovivienda,
      EstActual_Iluminacion: row.est_iluminacion ?? row.EstActual_Iluminacion,
      EstActual_Ventilacion: row.est_ventilacion ?? row.EstActual_Ventilacion,
      EstActual_Paredes: row.est_paredes ?? row.EstActual_Paredes,
      EstActual_Pisos: row.est_pisos ?? row.EstActual_Pisos,
      EstActual_Techo: row.est_techo ?? row.EstActual_Techo,
      tensionSistolica: row.tension_sistolica ?? row.tensionSistolica,
      tensionDiastolica: row.tension_diastolica ?? row.tensionDiastolica,
      perimetroAbdominal: row.perimetro_abdominal ?? row.perimetroAbdominal,
      perimetroBranquial: row.perimetro_branquial ?? row.perimetroBranquial,
      clasificacionImc: row.clasificacion_imc ?? row.clasificacionImc,
      Oizquierdo: row.o_izquierdo ?? row.Oizquierdo,
      Oderecho: row.o_derecho ?? row.Oderecho,
      Evacunal: row.evacunal ?? row.Evacunal,
      seleccionadosServPublic: row.serv_publicos ?? row.seleccionadosServPublic,
      seleccionadosFactoresRiesgo: row.factores_riesgo ?? row.seleccionadosFactoresRiesgo,
      seleccionadosPresenciaAnimales: row.presencia_animales ?? row.seleccionadosPresenciaAnimales,
      seleccionadosAntecedentes: row.antecedentes ?? row.seleccionadosAntecedentes,
      seleccionadosRiesgos: row.riesgos ?? row.seleccionadosRiesgos,
    };
  });
  return out;
}

function buildComunasBarriosMap(rows = []) {
  const out = {};
  rows.forEach((row) => {
    if (row?.id) {
      out[row.id] = { comuna: row.comuna ?? "", barrio: row.barrio ?? "" };
    }
  });
  return out;
}

function buildEpsMap(rows = []) {
  const out = {};
  rows.forEach((row) => {
    if (row?.id) {
      out[row.id] = { eps: row.eps ?? "" };
    }
  });
  return out;
}

function toLegacyIpsPayload(row = {}) {
  if (!row) return {};
  const source = row.datos && typeof row.datos === "object" ? row.datos : row;
  return {
    nombre: source.nombre ?? "",
    nit: source.nit ?? "",
    codHab: source.codHab ?? source.cod_hab ?? "",
    dpto: source.dpto ?? "",
    municipio: source.municipio ?? "",
  };
}

function toApiIpsPayload(data = {}) {
  const source = data?.datos && typeof data.datos === "object" ? data.datos : (data || {});
  return {
    nombre: String(source.nombre ?? "").trim(),
    nit: String(source.nit ?? "").trim(),
    codHab: String(source.codHab ?? source.cod_hab ?? "").trim(),
    dpto: String(source.dpto ?? "").trim(),
    municipio: String(source.municipio ?? "").trim(),
  };
}

function fromApiAgenda(row = {}) {
  return {
    id: row.id,
    idAgenda: row.id,
    idEncuesta: row.encuesta_id,
    fecha: row.fecha,
    grupo: row.grupo,
    tomademuestras: row.toma_muestras ?? null,
    visitamedica: row.visita_medica ?? null,
  };
}

function toApiAgenda(id, payload = {}, currentApi = null) {
  const currentLegacy = currentApi ? fromApiAgenda(currentApi) : {};
  const merged = {
    ...currentLegacy,
    ...payload,
    id: id || payload.id || payload.idAgenda || currentLegacy.id,
    idAgenda: id || payload.id || payload.idAgenda || currentLegacy.id,
    idEncuesta: payload.idEncuesta ?? payload.encuesta_id ?? currentLegacy.idEncuesta,
  };

  return {
    id: merged.id,
    encuestaId: merged.idEncuesta,
    fecha: normalizeDateValue(
      merged.fecha
      ?? (Array.isArray(merged.tomademuestras) ? merged.tomademuestras[0]?.fechaAgenda : merged.tomademuestras?.fechaAgenda)
      ?? (Array.isArray(merged.visitamedica) ? merged.visitamedica[0]?.fechaAgenda : merged.visitamedica?.fechaAgenda)
    ) ?? null,
    grupo: merged.grupo
      ?? (Array.isArray(merged.tomademuestras) ? merged.tomademuestras[0]?.grupo : merged.tomademuestras?.grupo)
      ?? (Array.isArray(merged.visitamedica) ? merged.visitamedica[0]?.grupo : merged.visitamedica?.grupo)
      ?? null,
    tomaMuestras: merged.tomademuestras ?? null,
    visitaMedica: merged.visitamedica ?? null,
  };
}

function buildAgendasMap(rows = []) {
  const out = {};
  rows.forEach((row) => {
    if (row?.id) {
      out[row.id] = fromApiAgenda(row);
    }
  });
  return out;
}

function fromApiContrato(row = {}) {
  return {
    epsId: row.eps_id ?? row.epsId ?? null,
    epsNombre: row.eps_nombre ?? row.epsNombre ?? "",
    cups: row.cups ?? [],
    fechaCreacion: row.fecha_creacion ?? row.fechaCreacion ?? null,
  };
}

function toApiContrato(payload = {}, id = null) {
  return {
    id: id || payload.id,
    ipsId: payload.ipsId ?? payload.ips_id ?? null,
    epsId: payload.epsId ?? payload.eps_id ?? null,
    epsNombre: payload.epsNombre ?? payload.eps_nombre ?? "",
    cups: payload.cups ?? [],
    fechaCreacion: payload.fechaCreacion ?? payload.fecha_creacion ?? null,
  };
}

function buildContratosMap(rows = []) {
  const out = {};
  rows.forEach((row) => {
    if (row?.id) {
      out[row.id] = fromApiContrato(row);
    }
  });
  return out;
}

function fromApiCup(row = {}) {
  const profesionales = Array.from(new Set(
    (Array.isArray(row.profesional)
      ? row.profesional
      : (Array.isArray(row.roles)
        ? row.roles
        : (Array.isArray(row.Roles) ? row.Roles : (row.profesional ? [row.profesional] : []))))
      .map((item) => String(item || "").trim())
      .filter(Boolean)
  ));

  return {
    codigo: row.codigo ?? "",
    DescripcionCUP: row.descripcion_cup ?? row.DescripcionCUP ?? "",
    profesional: profesionales,
    Grupo: row.grupo ?? row.Grupo ?? "",
    Eps: Array.isArray(row.eps_ids) ? row.eps_ids : (Array.isArray(row.Eps) ? row.Eps : []),
  };
}

function toApiCup(payload = {}, id = null) {
  const profesionales = Array.from(new Set(
    (Array.isArray(payload.profesional)
      ? payload.profesional
      : (Array.isArray(payload.roles)
        ? payload.roles
        : (Array.isArray(payload.Roles) ? payload.Roles : (payload.profesional ? [payload.profesional] : []))))
      .map((item) => String(item || "").trim())
      .filter(Boolean)
  ));

  return {
    id: id || payload.id,
    ipsId: payload.ipsId ?? payload.ips_id ?? null,
    codigo: payload.codigo ?? "",
    descripcion_cup: payload.descripcion_cup ?? payload.DescripcionCUP ?? payload.nombre ?? "",
    profesional: profesionales[0] ?? "",
    grupo: payload.grupo ?? payload.Grupo ?? "",
    roles: profesionales,
    eps_ids: Array.isArray(payload.eps_ids) ? payload.eps_ids : (Array.isArray(payload.Eps) ? payload.Eps : []),
  };
}

function buildCupsMap(rows = []) {
  const out = {};
  rows.forEach((row) => {
    if (row?.id) {
      out[row.id] = fromApiCup(row);
    }
  });
  return out;
}

function fromApiActividadExtra(row = {}) {
  return {
    key: row.clave ?? row.key ?? "",
    nombre: row.nombre ?? "",
    descripcion: row.descripcion ?? "",
    Profesional: Array.isArray(row.profesionales)
      ? row.profesionales
      : (Array.isArray(row.Profesional) ? row.Profesional : []),
  };
}

function toApiActividadExtra(payload = {}, id = null) {
  return {
    id: id || payload.id,
    ipsId: payload.ipsId ?? payload.ips_id ?? null,
    clave: payload.clave ?? payload.key ?? "",
    nombre: payload.nombre ?? "",
    descripcion: payload.descripcion ?? "",
    profesionales: Array.isArray(payload.profesionales)
      ? payload.profesionales
      : (Array.isArray(payload.Profesional) ? payload.Profesional : []),
  };
}

function buildActividadesExtraMap(rows = []) {
  const out = {};
  rows.forEach((row) => {
    if (row?.id) {
      out[row.id] = fromApiActividadExtra(row);
    }
  });
  return out;
}

function fromApiUser(row = {}) {
  return {
    uid: row.id,
    id: row.id,
    ipsId: row.ipsId ?? row.idips ?? row.ips_id ?? null,
    nombres: row.nombre ?? row.nombres ?? "",
    documento: row.numDocumento ?? row.documento ?? "",
    email: row.email ?? "",
    cargo: row.cargo ?? "",
    estado: row.activo ?? row.estado ?? true,
    grupo: row.grupo ?? "",
    convenio: row.convenio ?? null,
  };
}

function toApiUser(payload = {}) {
  const estado = payload.estado;
  const activo = typeof estado === "boolean"
    ? estado
    : !["false", "0", "inactivo", "inactive"].includes(String(estado ?? "").trim().toLowerCase());

  return {
    nombre: payload.nombre ?? payload.nombres ?? "",
    numDocumento: payload.numDocumento ?? payload.documento ?? null,
    email: payload.email ?? "",
    cargo: payload.cargo ?? payload.rol ?? "",
    ipsId: payload.ipsId ?? payload.idips ?? payload.ips ?? null,
    password: payload.password,
    grupo: payload.grupo ?? "",
    convenio: payload.convenio ?? null,
    activo,
  };
}

function buildUsersMap(rows = []) {
  const out = {};
  rows.forEach((row) => {
    if (row?.id) {
      out[row.id] = fromApiUser(row);
    }
  });
  return out;
}

function toApiEncuesta(payload = {}) {
  return cleanObject({
    id: payload.id,
    tiporegistro: payload.tiporegistro ?? payload.tipoRegistro,
    idEncuestador: payload.idEncuestador ?? payload.id_encuestador,
    idMedicoAtiende: payload.idMedicoAtiende ?? payload.id_medico_atiende,
    idEnfermeroAtiende: payload.idEnfermeroAtiende ?? payload.id_enfermero_atiende,
    idPsicologoAtiende: payload.idPsicologoAtiende ?? payload.id_psicologo_atiende,
    idTsocialAtiende: payload.idTsocialAtiende ?? payload.id_tsocial_atiende,
    idNutricionistaAtiende: payload.idNutricionistaAtiende ?? payload.idNutriAtiende ?? payload.id_nutricionista_atiende,
    convenio: payload.convenio,
    eps: payload.eps,
    regimen: payload.regimen,
    grupo: payload.grupo,
    idEncuesta: payload.idEncuesta ?? payload.id_encuesta,
    nombre1: payload.nombre1,
    nombre2: payload.nombre2,
    apellido1: payload.apellido1,
    apellido2: payload.apellido2,
    tipodoc: payload.tipodoc,
    numdoc: payload.numdoc,
    sexo: payload.sexo,
    fechaNac: normalizeDateValue(payload.fechaNac ?? payload.fecha_nac),
    direccion: payload.direccion,
    telefono: payload.telefono,
    barrioVeredacomuna: serializeBarrioVeredaComuna(payload.barrioVeredacomuna ?? payload.barrio_vereda_comuna),
    desplazamiento: payload.desplazamiento,
    poblacionRiesgo: serializePoblacionRiesgo(payload.poblacionRiesgo ?? payload.poblacion_riesgo),
    requiereRemision: payload.requiereRemision ?? payload.requiere_remision,
    fecha: normalizeDateValue(payload.fecha),
    fechavisita: normalizeDateValue(payload.fechavisita ?? payload.fecha_visita),
    status_gest_aux: toStatusGestValue(payload.status_gest_aux),
    status_gest_medica: toStatusGestValue(payload.status_gest_medica),
    status_gest_enfermera: toStatusGestValue(payload.status_gest_enfermera),
    status_gest_psicologo: toStatusGestValue(payload.status_gest_psicologo),
    status_gest_tsocial: toStatusGestValue(payload.status_gest_tsocial),
    status_gest_nutricionista: toStatusGestValue(payload.status_gest_nutricionista ?? payload.status_gest_nutri),
    status_visita: toBit(payload.status_visita),
    status_caracterizacion: toBit(payload.status_caracterizacion),
    status_facturacion: toBit(payload.status_facturacion),
    fechagestEnfermera: normalizeDateTimeValue(payload.fechagestEnfermera ?? payload.fecha_gest_enfermera),
    fechagestMedica: normalizeDateTimeValue(payload.fechagestMedica ?? payload.fecha_gest_medica),
    fechagestPsicologo: normalizeDateTimeValue(payload.fechagestPsicologo ?? payload.fecha_gest_psicologo),
    fechagestTsocial: normalizeDateTimeValue(payload.fechagestTsocial ?? payload.fecha_gest_tsocial),
    fechagestNutricionista: normalizeDateTimeValue(payload.fechagestNutricionista ?? payload.fecha_gest_nutricionista),
    fechagestAuxiliar: normalizeDateTimeValue(payload.fechagestAuxiliar ?? payload.fecha_gest_auxiliar),
    fechaFacturacion: normalizeDateTimeValue(payload.fechaFacturacion ?? payload.FechaFacturacion ?? payload.fecha_facturacion),
    asig_fact: payload.asig_fact ?? payload.asigfact,
    agendaTomamuestra: payload.agendaTomamuestra ?? payload.Agenda_tomademuestras ?? payload.agenda_tomamuestra,
    agendaVisitaMedica: payload.agendaVisitaMedica ?? payload.Agenda_Visitamedica ?? payload.agenda_visita_medica,
  });
}

function toApiCaracterizacion(payload = {}) {
  return {
    id: payload.id,
    encuestaId: payload.idEncuesta ?? payload.encuesta_id,
    convenio: payload.convenio,
    visita: payload.visita,
    tipoVisita: payload.tipovisita ?? payload.tipo_visita,
    tipoVivienda: payload.tipovivienda ?? payload.tipo_vivienda,
    estado: payload.estadoCaracterizacion ?? payload.estado,
    estIluminacion: payload.EstActual_Iluminacion ?? payload.est_iluminacion,
    estVentilacion: payload.EstActual_Ventilacion ?? payload.est_ventilacion,
    estParedes: payload.EstActual_Paredes ?? payload.est_paredes,
    estPisos: payload.EstActual_Pisos ?? payload.est_pisos,
    estTecho: payload.EstActual_Techo ?? payload.est_techo,
    peso: payload.peso,
    talla: payload.talla,
    tensionSistolica: payload.tensionSistolica ?? payload.tension_sistolica,
    tensionDiastolica: payload.tensionDiastolica ?? payload.tension_diastolica,
    perimetroAbdominal: payload.perimetroAbdominal ?? payload.perimetro_abdominal,
    perimetroBranquial: payload.perimetroBranquial ?? payload.perimetro_branquial,
    oximetria: payload.oximetria,
    temperatura: payload.temperatura,
    imc: payload.imc,
    clasificacionImc: payload.clasificacionImc ?? payload.clasificacion_imc,
    oIzquierdo: payload.Oizquierdo ?? payload.o_izquierdo,
    oDerecho: payload.Oderecho ?? payload.o_derecho,
    evacunal: payload.Evacunal ?? payload.evacunal,
    servPublicos: payload.seleccionadosServPublic ?? payload.serv_publicos,
    factoresRiesgo: payload.seleccionadosFactoresRiesgo ?? payload.factores_riesgo,
    presenciaAnimales: payload.seleccionadosPresenciaAnimales ?? payload.presencia_animales,
    antecedentes: payload.seleccionadosAntecedentes ?? payload.antecedentes,
    grupoFamiliar: payload.grupoFamiliar ?? payload.grupo_familiar,
    riesgos: payload.seleccionadosRiesgos ?? payload.riesgos,
  };
}

function deleteBySegments(obj, segments = []) {
  if (!isObject(obj) || !segments.length) {
    return obj;
  }

  const output = { ...obj };
  let current = output;

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    if (!isObject(current[segment])) {
      return output;
    }
    current[segment] = { ...current[segment] };
    current = current[segment];
  }

  delete current[segments[segments.length - 1]];
  return output;
}

function resolveCupsByActividad(datosAsignaciones, actividadId = null) {
  const cupsRaw = datosAsignaciones?.cups;
  if (!cupsRaw) {
    return actividadId ? [] : {};
  }

  const cupsArray = Array.isArray(cupsRaw)
    ? cupsRaw
    : (typeof cupsRaw === "object"
      ? Object.entries(cupsRaw).map(([rowKey, cup]) => (
        cup && typeof cup === "object"
          ? { ...cup, _rowKey: cup._rowKey ?? rowKey }
          : cup
      ))
      : []);

  if (actividadId) {
    return cupsArray.filter((cup) => cup && String(cup.actividadId) === String(actividadId));
  }

  const grouped = {};
  cupsArray.forEach((cup) => {
    if (!cup) return;
    const key = String(cup.actividadId ?? "sin-actividad");
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(cup);
  });

  return grouped;
}

async function safeGetModuleById(moduleName, id, actor) {
  try {
    return await getModuleById(moduleName, id, actor);
  } catch (error) {
    if (error?.statusCode === 404) {
      return null;
    }
    throw error;
  }
}

async function safeGetUserById(id, actor) {
  try {
    return await getUserById(id, actor);
  } catch (error) {
    if (error?.statusCode === 404) {
      return null;
    }
    throw error;
  }
}

export async function getRealtimeValue(inputPath, actor = null) {
  const { root, id, rest } = toRouteInfo(inputPath);

  if (root === "encuesta") {
    if (!id) {
      const rows = await listModule("encuestas", { limit: 5000, offset: 0 }, actor);
      return buildEncuestasMap(rows);
    }

    const row = await safeGetModuleById("encuestas", id, actor);
    const mapped = buildEncuestasMap(row ? [row] : []);
    return mapped[id] || null;
  }

  if (root === "actividades") {
    if (!id) {
      const rows = await listModule("encuesta_actividades", { limit: 10000, offset: 0 }, actor);
      return buildActividadesMap(rows);
    }

    const rows = await listModule("encuesta_actividades", { encuestaId: id, limit: 200, offset: 0 }, actor);
    const encuestaNode = buildActividadesNode(rows) || { tipoActividad: {} };
    if (!rest.length) {
      return rows.length ? encuestaNode : null;
    }

    const nested = getBySegments(encuestaNode, rest);
    return nested === undefined ? null : nested;
  }

  if (root === "asignaciones") {
    if (!id) {
      const rows = await listModule("asignaciones", { limit: 5000, offset: 0 }, actor);
      return buildAsignacionesMap(rows);
    }

    const row = await safeGetModuleById("asignaciones", id, actor);
    const mapped = row ? toLegacyAsignacionPayload(row) : null;
    if (!rest.length) {
      return mapped;
    }

    const nested = getBySegments(mapped || {}, rest);
    return nested === undefined ? null : nested;
  }

  if (root === "caracterizacion") {
    if (!id) {
      const rows = await listModule("caracterizacion", { limit: 5000, offset: 0 }, actor);
      return buildCaracterizacionMap(rows);
    }

    const row = await safeGetModuleById("caracterizacion", id, actor);
    const mapped = buildCaracterizacionMap(row ? [row] : []);
    if (!rest.length) {
      return mapped[id] || null;
    }

    const nested = getBySegments(mapped[id] || {}, rest);
    return nested === undefined ? null : nested;
  }

  if (root === "agendas") {
    if (!id) {
      const rows = await listModule("agendas", { limit: 5000, offset: 0 }, actor);
      return buildAgendasMap(rows);
    }

    const row = await safeGetModuleById("agendas", id, actor);
    if (!row) {
      return null;
    }

    const mapped = fromApiAgenda(row);
    if (!rest.length) {
      return mapped;
    }

    const nested = getBySegments(mapped, rest);
    return nested === undefined ? null : nested;
  }

  if (root === "comunasybarrios") {
    if (!id) {
      const rows = await listModule("comunas_barrios", { limit: 5000, offset: 0 }, actor);
      return buildComunasBarriosMap(rows);
    }

    const row = await safeGetModuleById("comunas_barrios", id, actor);
    return row ? { comuna: row.comuna ?? "", barrio: row.barrio ?? "" } : null;
  }

  if (root === "eps") {
    if (!id) {
      const rows = await listModule("eps", { limit: 5000, offset: 0 }, actor);
      return buildEpsMap(rows);
    }

    const row = await safeGetModuleById("eps", id, actor);
    return row ? { eps: row.eps ?? "" } : null;
  }

  if (root === "contratos") {
    if (!id) {
      const rows = await listModule("contratos", { limit: 5000, offset: 0 }, actor);
      return buildContratosMap(rows);
    }

    const row = await safeGetModuleById("contratos", id, actor);
    return row ? fromApiContrato(row) : null;
  }

  if (root === "cups") {
    if (!id) {
      const rows = await listModule("cups", { limit: 5000, offset: 0 }, actor);
      return buildCupsMap(rows);
    }

    const row = await safeGetModuleById("cups", id, actor);
    return row ? fromApiCup(row) : null;
  }

  if (root === "ips") {
    if (!id) {
      const rows = await listModule("ips", { limit: 5000, offset: 0 }, actor);
      const out = {};
      rows.forEach((row) => {
        if (row?.id) {
          out[row.id] = toLegacyIpsPayload(row);
        }
      });
      return out;
    }

    const row = await safeGetModuleById("ips", id, actor);
    return row ? toLegacyIpsPayload(row) : null;
  }

  if (root === "actividadesextra") {
    if (!id) {
      const rows = await listModule("actividades_extra", { limit: 5000, offset: 0 }, actor);
      return buildActividadesExtraMap(rows);
    }

    const row = await safeGetModuleById("actividades_extra", id, actor);
    return row ? fromApiActividadExtra(row) : null;
  }

  if (root === "usuarios") {
    if (!id) {
      const rows = await getUsers(actor);
      return buildUsersMap(rows);
    }

    const row = await safeGetUserById(id, actor);
    if (!row) {
      return null;
    }

    const mapped = fromApiUser(row);
    if (!rest.length) {
      return mapped;
    }

    const nested = getBySegments(mapped, rest);
    return nested === undefined ? null : nested;
  }

  if (root === "cupsactividades" && id) {
    const asignacion = await safeGetModuleById("asignaciones", id, actor);
    if (!asignacion) {
      return null;
    }

    const datosAsignacion = toLegacyAsignacionPayload(asignacion);
    if (rest[0] === "tipoActividad" && rest[1]) {
      return resolveCupsByActividad(datosAsignacion, rest[1]);
    }
    return resolveCupsByActividad(datosAsignacion, null);
  }

  return getStoredRealtimeValue(inputPath);
}

export async function postRealtimeValue(inputPath, payload, actor = null) {
  const { root, id, rest } = toRouteInfo(inputPath);
  const data = withActorIpsId(payload || {}, actor);

  if (root === "encuesta" && !id) {
    const created = await createModule("encuestas", toApiEncuesta(data), actor);
    return { name: created?.id };
  }

  if (root === "actividades" && id && rest[0] === "tipoActividad") {
    const created = await createModule("encuesta_actividades", {
      encuestaId: id,
      actividadKey: data?.key || null,
      ipsId: data?.ipsId,
    }, actor);
    return { name: created?.id };
  }

  if (root === "caracterizacion" && !id) {
    const created = await createModule("caracterizacion", toApiCaracterizacion(data), actor);
    return { name: created?.id };
  }

  if (root === "agendas" && !id) {
    const created = await createModule("agendas", {
      id: data?.id ?? data?.idAgenda,
      encuestaId: data?.idEncuesta ?? null,
      fecha: data?.fecha ?? null,
      grupo: data?.grupo ?? null,
      tomaMuestras: data?.tomademuestras ?? null,
      visitaMedica: data?.visitamedica ?? null,
      ipsId: data?.ipsId,
    }, actor);
    return { name: created?.id };
  }

  if (root === "comunasybarrios" && !id) {
    const created = await createModule("comunas_barrios", {
      comuna: data?.comuna ?? "",
      barrio: data?.barrio ?? "",
      ipsId: data?.ipsId,
    }, actor);
    return { name: created?.id };
  }

  if (root === "eps" && !id) {
    const created = await createModule("eps", { eps: data?.eps ?? "", ipsId: data?.ipsId }, actor);
    return { name: created?.id };
  }

  if (root === "contratos" && !id) {
    const created = await createModule("contratos", toApiContrato(data), actor);
    return { name: created?.id };
  }

  if (root === "cups" && !id) {
    const created = await createModule("cups", toApiCup(data), actor);
    return { name: created?.id };
  }

  if (root === "ips" && !id) {
    const created = await createModule("ips", { id: data?.id, ...toApiIpsPayload(data) }, actor);
    return { name: created?.id };
  }

  if (root === "actividadesextra" && !id) {
    const created = await createModule("actividades_extra", toApiActividadExtra(data), actor);
    return { name: created?.id };
  }

  if (root === "usuarios" && !id) {
    const created = await createUserRecord(toApiUser(data), actor);
    return { name: created?.id };
  }

  return postStoredRealtimeValue(inputPath, payload ?? {});
}

export async function putRealtimeValue(inputPath, payload, actor = null) {
  const { root, id, rest } = toRouteInfo(inputPath);
  const data = withActorIpsId(payload || {}, actor);

  if (root === "encuesta" && id && !rest.length) {
    return await replaceModule("encuestas", id, toApiEncuesta(data), actor);
  }

  if (root === "asignaciones" && id && !rest.length) {
    return toLegacyAsignacionPayload(
      await replaceModule("asignaciones", id, { encuestaId: id, ...data }, actor)
    );
  }

  if (root === "agendas" && id && !rest.length) {
    const current = await safeGetModuleById("agendas", id, actor);
    const saved = await replaceModule("agendas", id, toApiAgenda(id, data, current), actor);
    return fromApiAgenda(saved);
  }

  if (root === "comunasybarrios" && id && !rest.length) {
    const saved = await replaceModule("comunas_barrios", id, {
      comuna: data?.comuna ?? "",
      barrio: data?.barrio ?? "",
      ipsId: data?.ipsId,
    }, actor);
    return { comuna: saved?.comuna ?? "", barrio: saved?.barrio ?? "" };
  }

  if (root === "eps" && id && !rest.length) {
    const saved = await replaceModule("eps", id, { eps: data?.eps ?? "", ipsId: data?.ipsId }, actor);
    return { eps: saved?.eps ?? "" };
  }

  if (root === "contratos" && id && !rest.length) {
    return fromApiContrato(await replaceModule("contratos", id, toApiContrato(data, id), actor));
  }

  if (root === "cups" && id && !rest.length) {
    return fromApiCup(await replaceModule("cups", id, toApiCup(data, id), actor));
  }

  if (root === "ips" && id && !rest.length) {
    return toLegacyIpsPayload(await replaceModule("ips", id, { id, ...toApiIpsPayload(data) }, actor));
  }

  if (root === "actividadesextra" && id && !rest.length) {
    return fromApiActividadExtra(await replaceModule("actividades_extra", id, toApiActividadExtra(data, id), actor));
  }

  if (root === "usuarios" && id && !rest.length) {
    await updateUserRecord(id, toApiUser(data), actor);
    return fromApiUser({ id, ...(await safeGetUserById(id, actor)) });
  }

  return putStoredRealtimeValue(inputPath, payload ?? {});
}

export async function patchRealtimeValue(inputPath, payload, actor = null) {
  const { root, id, rest } = toRouteInfo(inputPath);
  const data = withActorIpsId(payload || {}, actor);

  if (root === "encuesta" && id && !rest.length) {
    return await patchModule("encuestas", id, toApiEncuesta(data), actor);
  }

  if (root === "asignaciones" && id) {
    const current = await safeGetModuleById("asignaciones", id, actor);
    const currentDatos = toLegacyAsignacionPayload(current || {});

    if (!rest.length) {
      const merged = deepMerge(currentDatos, data || {});
      return toLegacyAsignacionPayload(
        await replaceModule("asignaciones", id, { encuestaId: id, ...withActorIpsId(merged, actor) }, actor)
      );
    }

    const nestedCurrent = getBySegments(currentDatos, rest);
    const nextNested = isObject(nestedCurrent) ? deepMerge(nestedCurrent, data || {}) : (data || {});
    let nextDatos = { ...currentDatos };
    let cursor = nextDatos;
    for (let index = 0; index < rest.length - 1; index += 1) {
      const segment = rest[index];
      cursor[segment] = isObject(cursor[segment]) ? { ...cursor[segment] } : {};
      cursor = cursor[segment];
    }
    cursor[rest[rest.length - 1]] = nextNested;
    const saved = await replaceModule("asignaciones", id, { encuestaId: id, ...withActorIpsId(nextDatos, actor) }, actor);
    return getBySegments(toLegacyAsignacionPayload(saved), rest) || null;
  }

  if (root === "agendas" && id) {
    const current = await safeGetModuleById("agendas", id, actor);
    if (!current) {
      const created = await replaceModule("agendas", id, toApiAgenda(id, data, null), actor);
      return fromApiAgenda(created);
    }

    const currentLegacy = fromApiAgenda(current);
    if (!rest.length) {
      const nextLegacy = deepMerge(currentLegacy, data || {});
      const saved = await replaceModule("agendas", id, toApiAgenda(id, nextLegacy, current), actor);
      return fromApiAgenda(saved);
    }

    const nestedCurrent = getBySegments(currentLegacy, rest);
    const nextNested = isObject(nestedCurrent) ? deepMerge(nestedCurrent, data || {}) : (data || {});
    const nextLegacy = JSON.parse(JSON.stringify(currentLegacy));
    let cursor = nextLegacy;
    for (let index = 0; index < rest.length - 1; index += 1) {
      const segment = rest[index];
      cursor[segment] = isObject(cursor[segment]) ? { ...cursor[segment] } : {};
      cursor = cursor[segment];
    }
    cursor[rest[rest.length - 1]] = nextNested;
    const saved = await replaceModule("agendas", id, toApiAgenda(id, nextLegacy, current), actor);
    return getBySegments(fromApiAgenda(saved), rest) || null;
  }

  if (root === "caracterizacion" && id && !rest.length) {
    const saved = await patchModule("caracterizacion", id, toApiCaracterizacion(data), actor);
    const mapped = buildCaracterizacionMap([saved]);
    return mapped[id] || null;
  }

  if (root === "comunasybarrios" && id && !rest.length) {
    const saved = await patchModule("comunas_barrios", id, { comuna: data?.comuna, barrio: data?.barrio }, actor);
    return { comuna: saved?.comuna ?? "", barrio: saved?.barrio ?? "" };
  }

  if (root === "eps" && id && !rest.length) {
    const saved = await patchModule("eps", id, { eps: data?.eps }, actor);
    return { eps: saved?.eps ?? "" };
  }

  if (root === "contratos" && id && !rest.length) {
    return fromApiContrato(await patchModule("contratos", id, toApiContrato(data), actor));
  }

  if (root === "cups" && id && !rest.length) {
    return fromApiCup(await patchModule("cups", id, toApiCup(data), actor));
  }

  if (root === "ips" && id && !rest.length) {
    return toLegacyIpsPayload(await patchModule("ips", id, toApiIpsPayload(data), actor));
  }

  if (root === "actividadesextra" && id && !rest.length) {
    return fromApiActividadExtra(await patchModule("actividades_extra", id, toApiActividadExtra(data), actor));
  }

  if (root === "usuarios" && id && !rest.length) {
    if (Object.prototype.hasOwnProperty.call(data || {}, "password")) {
      return await updateUserPasswordRecord(id, {
        password: data.password,
        mustChangePassword: data.password === "12345",
      }, actor);
    }

    await updateUserRecord(id, toApiUser(data), actor);
    return fromApiUser({ id, ...(await safeGetUserById(id, actor)) });
  }

  return patchStoredRealtimeValue(inputPath, payload ?? {});
}

export async function deleteRealtimeValue(inputPath, actor = null) {
  const { root, id, rest } = toRouteInfo(inputPath);

  if (root === "encuesta" && id && !rest.length) {
    await removeModule("encuestas", id, actor);
    return null;
  }

  if (root === "actividades" && id && !rest.length) {
    const related = await listModule("encuesta_actividades", { encuestaId: id, limit: 200, offset: 0 }, actor);
    await Promise.all(related.map((row) => removeModule("encuesta_actividades", row.id, actor)));
    return null;
  }

  if (root === "asignaciones" && id) {
    if (!rest.length) {
      await removeModule("asignaciones", id, actor);
      return null;
    }

    const current = await safeGetModuleById("asignaciones", id, actor);
    if (!current) {
      return null;
    }

    const nextDatos = deleteBySegments(toLegacyAsignacionPayload(current), rest);
    await replaceModule("asignaciones", id, { encuestaId: id, ...nextDatos }, actor);
    return null;
  }

  if (root === "agendas" && id) {
    if (!rest.length) {
      await removeModule("agendas", id, actor);
      return null;
    }

    const current = await safeGetModuleById("agendas", id, actor);
    if (!current) {
      return null;
    }

    const currentLegacy = fromApiAgenda(current);
    const nextLegacy = deleteBySegments(currentLegacy, rest);
    await replaceModule("agendas", id, toApiAgenda(id, nextLegacy, current), actor);
    return null;
  }

  if (root === "caracterizacion" && id && !rest.length) {
    await removeModule("caracterizacion", id, actor);
    return null;
  }

  if (root === "comunasybarrios" && id && !rest.length) {
    await removeModule("comunas_barrios", id, actor);
    return null;
  }

  if (root === "eps" && id && !rest.length) {
    await removeModule("eps", id, actor);
    return null;
  }

  if (root === "contratos" && id && !rest.length) {
    await removeModule("contratos", id, actor);
    return null;
  }

  if (root === "cups" && id && !rest.length) {
    await removeModule("cups", id, actor);
    return null;
  }

  if (root === "ips" && id && !rest.length) {
    await removeModule("ips", id, actor);
    return null;
  }

  if (root === "actividadesextra" && id && !rest.length) {
    await removeModule("actividades_extra", id, actor);
    return null;
  }

  if (root === "usuarios" && id && !rest.length) {
    await deleteUserRecord(id, actor);
    return null;
  }

  return deleteStoredRealtimeValue(inputPath);
}