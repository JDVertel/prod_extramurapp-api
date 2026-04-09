import { AppError } from "../utils/app-error.js";
import {
  createContrato,
  deleteContrato,
  findContratoById,
  listContratos,
  replaceContrato,
} from "../repositories/contrato.repository.js";

function resolveActorIpsId(actor) {
  if (!actor) return null;
  const raw = actor.ipsId ?? actor.ips_id ?? null;
  if (!raw) return null;
  const str = String(raw).trim();
  return str || null;
}

export async function listContratosService(query = {}, actor = null) {
  const limit = Math.min(Math.max(Number(query.limit || 100), 1), 500);
  const offset = Math.max(Number(query.offset || 0), 0);
  const ipsId = resolveActorIpsId(actor);
  return listContratos({ limit, offset, ipsId });
}

export async function getContratoByIdService(id, actor = null) {
  const ipsId = resolveActorIpsId(actor);
  const row = await findContratoById(id, { ipsId });
  if (!row) {
    throw new AppError("Contrato no encontrado", 404);
  }
  return row;
}

export async function createContratoService(payload = {}, actor = null) {
  const ipsId = resolveActorIpsId(actor);
  const row = await createContrato(payload, { ipsId });
  if (!row) {
    throw new AppError("No se pudo crear el contrato", 500);
  }
  return row;
}

export async function replaceContratoService(id, payload = {}, actor = null) {
  const ipsId = resolveActorIpsId(actor);
  return replaceContrato(id, payload, { ipsId });
}

export async function removeContratoService(id, actor = null) {
  const ipsId = resolveActorIpsId(actor);
  const affected = await deleteContrato(id, { ipsId });
  if (!affected) {
    throw new AppError("Contrato no encontrado", 404);
  }
  return { message: "Contrato eliminado" };
}
