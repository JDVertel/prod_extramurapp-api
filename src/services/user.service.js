// Nueva lógica de carga masiva de usuarios desde CSV
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

function scoreDecodedCsv(value) {
  const text = String(value || '');
  let score = 0;

  if (text.includes('\uFFFD')) {
    score -= 10;
  }

  const accentedMatches = text.match(/[ÁÉÍÓÚáéíóúÑñÜü]/g);
  if (accentedMatches) {
    score += accentedMatches.length;
  }

  return score;
}

function decodeCsvBuffer(buffer) {
  const utf8Text = buffer.toString('utf8');
  const latin1Text = buffer.toString('latin1');

  return scoreDecodedCsv(latin1Text) > scoreDecodedCsv(utf8Text)
    ? latin1Text
    : utf8Text;
}

function getBulkValue(row, keys) {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
}

function mapBulkUserRow(row = {}) {
  const documento = getBulkValue(row, ['Documento', 'documento', 'numDocumento', 'num_documento']);

  return {
    email: getBulkValue(row, ['Email', 'email']),
    nombre: getBulkValue(row, ['Nombre', 'nombre']),
    cargo: getBulkValue(row, ['Cargo', 'cargo']),
    grupo: getBulkValue(row, ['Grupo', 'grupo']),
    convenio: getBulkValue(row, ['Convenio', 'convenio']),
    numDocumento: documento,
    password: documento,
    activo: true,
    ipsId: getBulkValue(row, ['idips', 'ipsId', 'ips_id', 'ips']),
  };
}

export async function bulkCreateUsers(rows, actor = null) {
  ensure(Array.isArray(rows) && rows.length > 0, 'No se recibieron usuarios para procesar', 400);

  let creados = 0;
  let errores = 0;
  const detalles = [];

  for (const row of rows) {
    const userPayload = mapBulkUserRow(row);
    const rowEmail = userPayload.email || getBulkValue(row, ['Email', 'email']) || 'sin-email';

    try {
      await createUserRecord(userPayload, actor);
      creados++;
      detalles.push({ email: rowEmail, status: 'creado' });
    } catch (err) {
      errores++;
      detalles.push({ email: rowEmail, status: 'error', error: err.message });
    }
  }

  return { creados, errores, detalles };
}

export async function bulkCreateUsersFromCsv(filePath, actor = null) {
  // Leer el archivo CSV
  const csvBuffer = fs.readFileSync(path.resolve(filePath));
  const csvContent = decodeCsvBuffer(csvBuffer);
  const { data, errors } = Papa.parse(csvContent, { header: true, skipEmptyLines: true });
  if (errors && errors.length > 0) {
    throw new Error('Error al parsear el archivo CSV: ' + errors.map(e => e.message).join('; '));
  }
  return bulkCreateUsers(data, actor);
}
import { randomUUID } from "node:crypto";
import { ensure, AppError } from "../utils/app-error.js";
import { hashPassword } from "../utils/auth.js";
import { normalizeDocument, normalizeEmail, toUserResponse } from "../models/user.model.js";
import {
  clearUserLockState,
  createUser,
  deleteUser,
  findUserById,
  findUserByIdAndIps,
  findUserIdByDocument,
  findUserIdByEmail,
  listUsers,
  listUsersByIpsId,
  updateUser,
} from "../repositories/user.repository.js";

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

function normalizeBandejas(value) {
  if (!Array.isArray(value)) {
    return JSON.stringify([]);
  }

  const limpias = Array.from(
    new Set(
      value
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    )
  );

  return JSON.stringify(limpias);
}

function normalizeAccesosProfesionales(value) {
  if (!Array.isArray(value)) {
    return JSON.stringify([]);
  }

  const limpios = Array.from(
    new Set(
      value
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    )
  );

  return JSON.stringify(limpios);
}

const CARGOS_PROFESIONALES_NORMALIZADOS = new Set([
  "auxiliardeenfermeria",
  "auxiliar",
  "medico",
  "enfermero",
  "psicologo",
  "tsocial",
  "trabajadorsocial",
  "trabajadorasocial",
  "nutricionista",
  "fact",
  "facturacion",
]);

function normalizeCargo(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function isProfessionalCargo(value) {
  return CARGOS_PROFESIONALES_NORMALIZADOS.has(normalizeCargo(value));
}

export async function checkEmailExists(email) {
  const normalized = normalizeEmail(email);
  ensure(normalized, "email requerido", 400);
  const existing = await findUserIdByEmail(normalized);
  return { exists: Boolean(existing) };
}

export async function checkDocumentExists(numDocumento) {
  const normalized = normalizeDocument(numDocumento);
  ensure(normalized, "numDocumento requerido", 400);
  const existing = await findUserIdByDocument(normalized);
  return { exists: Boolean(existing) };
}

export async function getUsers(actor = null) {
  const actorIpsId = resolveActorIpsId(actor);
  const rows = shouldRestrictByActorIps(actor) && actorIpsId
    ? await listUsersByIpsId(actorIpsId)
    : await listUsers();
  return rows.map(toUserResponse);
}

export async function getDelegatedProfessionals(actor = null) {
  const rows = await listUsers();
  const profesionales = rows
    .map(toUserResponse)
    .filter((user) => {
      return isProfessionalCargo(user?.cargo) && user?.activo !== false;
    });

  const cargoActor = String(actor?.cargo || "").trim().toLowerCase();
  const isAdminActor = cargoActor === "admin" || cargoActor === "administrador" || cargoActor === "superusuario";
  if (isAdminActor) {
    return profesionales.sort((a, b) => String(a?.nombre || "").localeCompare(String(b?.nombre || "")));
  }

  const actorId = String(actor?.id || actor?.sub || "").trim();
  if (!actorId) {
    return [];
  }

  const actorRow = await findUserById(actorId);
  if (!actorRow) {
    return [];
  }

  const actorData = toUserResponse(actorRow);
  const accesos = Array.isArray(actorData?.accesosProfesionales)
    ? actorData.accesosProfesionales
    : [];
  const accesosSet = new Set(accesos.map((item) => String(item || "").trim()).filter(Boolean));

  return profesionales
    .filter((user) => {
      const documento = String(user?.numDocumento || "").trim();
      return documento && accesosSet.has(documento);
    })
    .sort((a, b) => String(a?.nombre || "").localeCompare(String(b?.nombre || "")));
}

export async function getUserById(id, actor = null) {
  const actorIpsId = resolveActorIpsId(actor);
  const row = shouldRestrictByActorIps(actor) && actorIpsId
    ? await findUserByIdAndIps(id, actorIpsId)
    : await findUserById(id);

  if (!row) {
    throw new AppError("Usuario no encontrado", 404);
  }
  return toUserResponse(row);
}

export async function createUserRecord(payload, actor = null) {
  const email = normalizeEmail(payload.email);
  ensure(email && payload.password && payload.nombre && payload.cargo, "email, password, nombre y cargo son obligatorios", 400);

  // Solo el superusuario puede crear administradores
  const targetCargo = String(payload.cargo || "").trim();
  if (targetCargo === "admin") {
    ensure(actor?.cargo === "superusuario", "Solo el superusuario puede crear administradores", 403);
  }
  // Solo el superusuario puede crear otros superusuarios
  if (targetCargo === "superusuario") {
    ensure(actor?.cargo === "superusuario", "Solo el superusuario puede crear superusuarios", 403);
  }

  const existing = await findUserIdByEmail(email);
  ensure(!existing, "El email ya existe", 409);

  const numDocumento = payload.numDocumento ? normalizeDocument(payload.numDocumento) : null;
  if (numDocumento) {
    const existingDocument = await findUserIdByDocument(numDocumento);
    ensure(!existingDocument, "El documento ya existe", 409);
  }

  const id = randomUUID();
  const passwordHash = await hashPassword(payload.password);
  const actorIpsId = resolveActorIpsId(actor);

  let targetIpsId = normalizeIpsId(payload.ipsId ?? payload.idips ?? payload.ips);

  if (actor && shouldRestrictByActorIps(actor)) {
    ensure(actorIpsId, "No se detectó una IPS válida en tu sesión", 400);
    targetIpsId = actorIpsId;
  }

  // superusuario y admin creados por superusuario pueden no tener IPS (superusuario global)
  if (targetCargo !== "superusuario") {
    ensure(targetIpsId, "El usuario debe quedar asociado a una IPS", 400);
  }

  await createUser({
    id,
    email,
    passwordHash,
    nombre: payload.nombre,
    cargo: payload.cargo,
    ipsId: targetIpsId,
    convenio: payload.convenio || null,
    grupo: payload.grupo || null,
    numDocumento,
    activo: payload.activo === false ? 0 : 1,
    bandejas: normalizeBandejas(payload.bandejas),
    accesosProfesionales: normalizeAccesosProfesionales(payload.accesosProfesionales),
    mustChangePassword: 1,
  });

  return {
    id,
    email,
    nombre: payload.nombre,
    cargo: payload.cargo,
    ipsId: targetIpsId,
    convenio: payload.convenio || null,
    grupo: payload.grupo || null,
    numDocumento,
    activo: payload.activo !== false,
  };
}

export async function updateUserRecord(id, payload, actor = null) {
  const actorIpsId = resolveActorIpsId(actor);
  const targetUser = shouldRestrictByActorIps(actor) && actorIpsId
    ? await findUserByIdAndIps(id, actorIpsId)
    : await findUserById(id);

  if (!targetUser) {
    throw new AppError("Usuario no encontrado", 404);
  }

  const payloadIpsId = normalizeIpsId(payload.ipsId ?? payload.ips);
  const canSetIps = actor?.cargo === "superusuario";

  const affected = await updateUser(id, {
    nombre: payload.nombre ?? undefined,
    cargo: payload.cargo ?? undefined,
    ips_id: payload.ipsId !== undefined || payload.ips !== undefined
      ? (canSetIps ? (payloadIpsId || actorIpsId) : actorIpsId)
      : undefined,
    convenio: payload.convenio ?? undefined,
    grupo: payload.grupo ?? undefined,
    activo: typeof payload.activo === "boolean" ? (payload.activo ? 1 : 0) : undefined,
    bandejas: payload.bandejas !== undefined ? normalizeBandejas(payload.bandejas) : undefined,
    accesos_profesionales: payload.accesosProfesionales !== undefined
      ? normalizeAccesosProfesionales(payload.accesosProfesionales)
      : undefined,
  });

  if (!affected) {
    throw new AppError("Usuario no encontrado", 404);
  }

  return { message: "Usuario actualizado" };
}

export async function deleteUserRecord(id, actor = null) {
  const actorIpsId = resolveActorIpsId(actor);
  const targetUser = shouldRestrictByActorIps(actor) && actorIpsId
    ? await findUserByIdAndIps(id, actorIpsId)
    : await findUserById(id);

  if (!targetUser) {
    throw new AppError("Usuario no encontrado", 404);
  }

  const affected = await deleteUser(id);
  if (!affected) {
    throw new AppError("Usuario no encontrado", 404);
  }
  return { message: "Usuario eliminado" };
}

export async function updateUserPasswordRecord(id, payload, actor = null) {
  ensure(payload.password && String(payload.password).length >= 4, "password es obligatorio", 400);

  const actorIpsId = resolveActorIpsId(actor);
  const targetUser = shouldRestrictByActorIps(actor) && actorIpsId
    ? await findUserByIdAndIps(id, actorIpsId)
    : await findUserById(id);

  if (!targetUser) {
    throw new AppError("Usuario no encontrado", 404);
  }

  const passwordHash = await hashPassword(String(payload.password));
  const affected = await updateUser(id, {
    password_hash: passwordHash,
    must_change_password: payload.mustChangePassword === undefined
      ? undefined
      : (payload.mustChangePassword ? 1 : 0),
  });

  if (!affected) {
    throw new AppError("Usuario no encontrado", 404);
  }

  return { message: "Contrasena actualizada correctamente" };
}

export async function unlockUserRecord(id, actor = null) {
  const cargoActor = String(actor?.cargo || "").trim().toLowerCase();
  ensure(
    cargoActor === "admin" || cargoActor === "superusuario",
    "Solo administradores pueden desbloquear usuarios",
    403
  );

  const actorIpsId = resolveActorIpsId(actor);
  const targetUser = shouldRestrictByActorIps(actor) && actorIpsId
    ? await findUserByIdAndIps(id, actorIpsId)
    : await findUserById(id);

  if (!targetUser) {
    throw new AppError("Usuario no encontrado", 404);
  }

  const affected = await clearUserLockState(id);
  if (!affected) {
    throw new AppError("Usuario no encontrado", 404);
  }

  return { message: "Usuario desbloqueado correctamente" };
}