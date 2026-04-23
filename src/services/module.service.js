import { ensure, AppError } from "../utils/app-error.js";
import { getRealtimeValue } from "./realtime-store.service.js";
import {
  createModuleRow,
  deleteModuleRow,
  findCaracterizacionByEncuestaId,
  findModuleRowById,
  getModuleConfig,
  listModuleRows,
  updateModuleRow,
} from "../repositories/module.repository.js";

export function resolveModuleConfig(moduleName) {
  const config = getModuleConfig(moduleName);
  ensure(config, "Modulo no soportado", 404);
  return config;
}

function normalizeIpsId(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function resolveActorIpsId(actor) {
  return normalizeIpsId(actor?.ipsId ?? actor?.ips_id ?? actor?.ips);
}

function shouldRestrictByActorIps(actor) {
  return actor?.cargo !== "superusuario";
}

function hasIpsColumn(config) {
  return Array.isArray(config?.columns) && config.columns.includes("ips_id");
}

function isEmptyCaracterizacionValue(value) {
  if (value === undefined || value === null) {
    return true;
  }

  if (typeof value === "string") {
    return value.trim() === "";
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  if (typeof value === "object") {
    return Object.keys(value).length === 0;
  }

  return false;
}

function pickLegacyCaracterizacionField(payload, keys = []) {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(payload || {}, key)) {
      continue;
    }

    const value = payload[key];
    if (!isEmptyCaracterizacionValue(value)) {
      return value;
    }
  }

  return undefined;
}

function buildLegacyCaracterizacionOverlay(payload = {}) {
  return {
    visita: pickLegacyCaracterizacionField(payload, ["visita"]),
    tipo_visita: pickLegacyCaracterizacionField(payload, ["tipo_visita", "tipoVisita", "tipovisita"]),
    tipo_vivienda: pickLegacyCaracterizacionField(payload, ["tipo_vivienda", "tipoVivienda", "tipovivienda"]),
    estado: pickLegacyCaracterizacionField(payload, ["estado", "estadoCaracterizacion"]),
    est_iluminacion: pickLegacyCaracterizacionField(payload, ["est_iluminacion", "estIluminacion", "EstActual_Iluminacion"]),
    est_ventilacion: pickLegacyCaracterizacionField(payload, ["est_ventilacion", "estVentilacion", "EstActual_Ventilacion"]),
    est_paredes: pickLegacyCaracterizacionField(payload, ["est_paredes", "estParedes", "EstActual_Paredes"]),
    est_pisos: pickLegacyCaracterizacionField(payload, ["est_pisos", "estPisos", "EstActual_Pisos"]),
    est_techo: pickLegacyCaracterizacionField(payload, ["est_techo", "estTecho", "EstActual_Techo"]),
    peso: pickLegacyCaracterizacionField(payload, ["peso"]),
    talla: pickLegacyCaracterizacionField(payload, ["talla"]),
    tension_sistolica: pickLegacyCaracterizacionField(payload, ["tension_sistolica", "tensionSistolica"]),
    tension_diastolica: pickLegacyCaracterizacionField(payload, ["tension_diastolica", "tensionDiastolica"]),
    perimetro_abdominal: pickLegacyCaracterizacionField(payload, ["perimetro_abdominal", "perimetroAbdominal"]),
    perimetro_branquial: pickLegacyCaracterizacionField(payload, ["perimetro_branquial", "perimetroBranquial"]),
    oximetria: pickLegacyCaracterizacionField(payload, ["oximetria"]),
    temperatura: pickLegacyCaracterizacionField(payload, ["temperatura"]),
    imc: pickLegacyCaracterizacionField(payload, ["imc"]),
    clasificacion_imc: pickLegacyCaracterizacionField(payload, ["clasificacion_imc", "clasificacionImc"]),
    o_izquierdo: pickLegacyCaracterizacionField(payload, ["o_izquierdo", "oIzquierdo", "Oizquierdo"]),
    o_derecho: pickLegacyCaracterizacionField(payload, ["o_derecho", "oDerecho", "Oderecho"]),
    evacunal: pickLegacyCaracterizacionField(payload, ["evacunal", "Evacunal"]),
    serv_publicos: pickLegacyCaracterizacionField(payload, ["serv_publicos", "servPublicos", "seleccionadosServPublic"]),
    factores_riesgo: pickLegacyCaracterizacionField(payload, ["factores_riesgo", "factoresRiesgo", "seleccionadosFactoresRiesgo"]),
    presencia_animales: pickLegacyCaracterizacionField(payload, ["presencia_animales", "presenciaAnimales", "seleccionadosPresenciaAnimales"]),
    antecedentes: pickLegacyCaracterizacionField(payload, ["antecedentes", "seleccionadosAntecedentes"]),
    grupo_familiar: pickLegacyCaracterizacionField(payload, ["grupo_familiar", "grupoFamiliar"]),
    riesgos: pickLegacyCaracterizacionField(payload, ["riesgos", "seleccionadosRiesgos"]),
  };
}

function mergeCaracterizacionWithLegacy(row, legacyPayload) {
  const overlay = buildLegacyCaracterizacionOverlay(legacyPayload);
  const merged = { ...row };

  Object.entries(overlay).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }

    if (isEmptyCaracterizacionValue(merged[key])) {
      merged[key] = value;
    }
  });

  return merged;
}

async function findLegacyCaracterizacionByEncuestaId(encuestaId) {
  const legacyMap = await getRealtimeValue("caracterizacion");
  if (!legacyMap || typeof legacyMap !== "object") {
    return null;
  }

  for (const [legacyId, value] of Object.entries(legacyMap)) {
    const payload = value && typeof value === "object" ? value : null;
    if (!payload) {
      continue;
    }

    const candidateEncuestaId = String(
      payload.idEncuesta ?? payload.encuestaId ?? payload.encuesta_id ?? ""
    ).trim();

    if (candidateEncuestaId && candidateEncuestaId === String(encuestaId || "").trim()) {
      return {
        id: legacyId,
        ...payload,
      };
    }
  }

  return null;
}

function resolvePayloadIpsId(payload) {
  return normalizeIpsId(payload?.ipsId ?? payload?.ips_id ?? payload?.ips);
}

function resolveScopedIpsId(config, actor, { requireWhenRestricted = false } = {}) {
  if (!hasIpsColumn(config)) {
    return null;
  }

  if (!shouldRestrictByActorIps(actor)) {
    return null;
  }

  const actorIpsId = resolveActorIpsId(actor);
  if (requireWhenRestricted) {
    ensure(actorIpsId, "El usuario autenticado no tiene IPS asociada", 400);
  }
  return actorIpsId;
}

function enforceIpsPayload(config, payload, actor) {
  const base = payload || {};
  if (!hasIpsColumn(config)) {
    return base;
  }

  const actorIpsId = resolveActorIpsId(actor);
  const payloadIpsId = resolvePayloadIpsId(base);
  const targetIpsId = shouldRestrictByActorIps(actor)
    ? actorIpsId
    : (payloadIpsId || actorIpsId);

  ensure(targetIpsId, "Debe enviar ipsId para este modulo", 400);

  return {
    ...base,
    ipsId: targetIpsId,
  };
}

export async function listModule(moduleName, query, actor = null) {
  const config = resolveModuleConfig(moduleName);
  const limit = Math.min(Math.max(Number(query.limit || 100), 1), 500);
  const offset = Math.max(Number(query.offset || 0), 0);
  const actorIpsId = resolveScopedIpsId(config, actor, { requireWhenRestricted: true });
  return listModuleRows(config, {
    limit,
    offset,
    filters: query,
    ipsId: shouldRestrictByActorIps(actor) ? actorIpsId : null,
  });
}

export async function getModuleById(moduleName, id, actor = null) {
  const config = resolveModuleConfig(moduleName);
  const actorIpsId = resolveScopedIpsId(config, actor, { requireWhenRestricted: true });
  const row = await findModuleRowById(config, id, {
    ipsId: shouldRestrictByActorIps(actor) ? actorIpsId : null,
  });

  if (!row) {
    throw new AppError("Registro no encontrado", 404);
  }
  return row;
}

export async function createModule(moduleName, payload, actor = null) {
  const config = resolveModuleConfig(moduleName);
  const scopedIpsId = resolveScopedIpsId(config, actor, { requireWhenRestricted: true });
  const result = await createModuleRow(config, enforceIpsPayload(config, payload, actor), {
    ipsId: scopedIpsId,
  });

  if (result.status === "empty-payload") {
    throw new AppError("Payload vacio o sin columnas validas", 400);
  }
  return result.row;
}

export async function replaceModule(moduleName, id, payload, actor = null) {
  const config = resolveModuleConfig(moduleName);
  const scopedIpsId = resolveScopedIpsId(config, actor, { requireWhenRestricted: true });
  const result = await updateModuleRow(
    config,
    id,
    enforceIpsPayload(config, payload, actor),
    { replace: true, ipsId: scopedIpsId }
  );

  if (result.status === "empty-payload") {
    throw new AppError("No hay campos para reemplazar", 400);
  }
  if (result.status === "not-found") {
    throw new AppError("Registro no encontrado", 404);
  }
  return result.row;
}

export async function patchModule(moduleName, id, payload, actor = null) {
  const config = resolveModuleConfig(moduleName);
  const scopedIpsId = resolveScopedIpsId(config, actor, { requireWhenRestricted: true });
  const result = await updateModuleRow(
    config,
    id,
    enforceIpsPayload(config, payload, actor),
    { replace: false, ipsId: scopedIpsId }
  );

  if (result.status === "empty-payload") {
    throw new AppError("No hay campos para actualizar", 400);
  }
  if (result.status === "not-found") {
    throw new AppError("Registro no encontrado", 404);
  }
  return result.row;
}

export async function removeModule(moduleName, id, actor = null) {
  const config = resolveModuleConfig(moduleName);
  const actorIpsId = resolveScopedIpsId(config, actor, { requireWhenRestricted: true });
  const affected = await deleteModuleRow(config, id, {
    ipsId: shouldRestrictByActorIps(actor) ? actorIpsId : null,
    actor,
  });

  if (!affected) {
    throw new AppError("Registro no encontrado", 404);
  }
  return { message: "Registro eliminado" };
}

export async function getCaracterizacionByEncuestaId(encuestaId, actor = null) {
  const config = resolveModuleConfig("caracterizacion");
  const actorIpsId = resolveScopedIpsId(config, actor, { requireWhenRestricted: true });
  const row = await findCaracterizacionByEncuestaId(encuestaId, {
    ipsId: shouldRestrictByActorIps(actor) ? actorIpsId : null,
  });

  const legacyPayload = await findLegacyCaracterizacionByEncuestaId(encuestaId);

  if (row) {
    return legacyPayload ? mergeCaracterizacionWithLegacy(row, legacyPayload) : row;
  }

  if (legacyPayload) {
    return buildLegacyCaracterizacionOverlay(legacyPayload);
  }

  throw new AppError("Caracterizacion no encontrada", 404);
}