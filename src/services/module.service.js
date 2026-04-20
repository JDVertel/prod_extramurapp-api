import { ensure, AppError } from "../utils/app-error.js";
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

  if (!row) {
    throw new AppError("Caracterizacion no encontrada", 404);
  }
  return row;
}