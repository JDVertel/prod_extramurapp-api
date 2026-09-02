import { AppError, ensure } from "../utils/app-error.js";
import {
  clearRegistrosByEpsBdId,
  countRegistrosByEpsBdId,
  createEpsBd,
  deleteEpsBd,
  findEpsBdById,
  insertRegistrosBulk,
  listAllRegistrosByEpsBdId,
  listEpsBd,
  listIndiceDocumentosEpsBd,
  listRegistrosByEpsBdId,
  updateEpsBd,
} from "../repositories/eps-bd.repository.js";

function normalizeNombre(value) {
  return String(value || "").trim();
}

function normalizeRegistro(row = {}) {
  return {
    tipoDocumento: String(row.tipoDocumento ?? row.tipo_documento ?? "").trim(),
    numdoc: String(row.numdoc ?? "").trim(),
    nombre1: String(row.nombre1 ?? "").trim(),
    apellido1: String(row.apellido1 ?? "").trim(),
  };
}

function isRegistroValido(row) {
  return Boolean(row.tipoDocumento && row.numdoc && row.nombre1 && row.apellido1);
}

async function requireEpsBd(id) {
  const eps = await findEpsBdById(id);
  ensure(eps, "EPS BD no encontrada", 404);
  return eps;
}

export async function getEpsBdList() {
  return listEpsBd();
}

export async function createEpsBdEntry(payload = {}) {
  const nombre = normalizeNombre(payload.nombre);
  ensure(nombre, "El nombre de la EPS es obligatorio");
  ensure(nombre.length <= 190, "El nombre no puede superar 190 caracteres");

  try {
    return await createEpsBd(nombre);
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      throw new AppError("Ya existe una EPS BD con ese nombre", 409);
    }
    throw error;
  }
}

export async function updateEpsBdEntry(id, payload = {}) {
  await requireEpsBd(id);
  const nombre = normalizeNombre(payload.nombre);
  ensure(nombre, "El nombre de la EPS es obligatorio");
  ensure(nombre.length <= 190, "El nombre no puede superar 190 caracteres");

  try {
    return await updateEpsBd(id, nombre);
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      throw new AppError("Ya existe una EPS BD con ese nombre", 409);
    }
    throw error;
  }
}

export async function removeEpsBdEntry(id) {
  await requireEpsBd(id);
  const resultado = await deleteEpsBd(id);
  ensure(resultado.deleted, "No se pudo eliminar la EPS BD", 404);
  return {
    ok: true,
    registrosEliminados: Number(resultado.registrosEliminados || 0),
  };
}

export async function getEpsBdRegistros(id, query = {}) {
  await requireEpsBd(id);
  const total = await countRegistrosByEpsBdId(id);
  const limit = query.limit !== undefined ? Number(query.limit) : 50;
  const offset = query.offset !== undefined ? Number(query.offset) : 0;
  const registros = await listRegistrosByEpsBdId(id, { limit, offset });

  return {
    total,
    limit,
    offset,
    registros,
  };
}

export async function getEpsBdIndiceDocumentos() {
  const registros = await listIndiceDocumentosEpsBd();
  return {
    total: registros.length,
    registros,
  };
}

export async function getEpsBdRegistrosExport(id) {
  await requireEpsBd(id);
  const registros = await listAllRegistrosByEpsBdId(id);
  return {
    total: registros.length,
    registros,
  };
}

export async function bulkImportEpsBdRegistros(id, payload = {}) {
  await requireEpsBd(id);

  const modo = String(payload.modo || "append").toLowerCase();
  ensure(["append", "replace"].includes(modo), 'Modo invalido. Use "append" o "replace".');

  const rawRegistros = Array.isArray(payload.registros) ? payload.registros : [];
  ensure(rawRegistros.length > 0, "No se recibieron registros para importar");

  const normalizados = rawRegistros.map(normalizeRegistro);
  const validos = normalizados.filter(isRegistroValido);
  const omitidos = normalizados.length - validos.length;

  ensure(validos.length > 0, "Ningun registro tiene los campos obligatorios completos");

  let eliminados = 0;
  if (modo === "replace") {
    eliminados = await clearRegistrosByEpsBdId(id);
  }

  const insertados = await insertRegistrosBulk(id, validos);
  const total = await countRegistrosByEpsBdId(id);

  return {
    modo,
    recibidos: rawRegistros.length,
    insertados,
    omitidos,
    eliminados,
    total,
  };
}
