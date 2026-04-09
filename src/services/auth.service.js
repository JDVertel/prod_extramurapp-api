import { randomUUID } from "node:crypto";
import { config } from "../utils/config.js";
import { AppError, ensure } from "../utils/app-error.js";
import { hashPassword, signToken, verifyPassword } from "../utils/auth.js";
import { normalizeEmail, toAuthLoginResponse } from "../models/user.model.js";
import {
  createPasswordResetToken,
  createUser,
  findUserForLogin,
  findUserIdByEmail,
  findValidPasswordResetToken,
  markPasswordResetTokenAsUsed,
  updateUser,
} from "../repositories/user.repository.js";

function normalizeIpsId(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

export async function registerAdmin(payload) {
  const email = normalizeEmail(payload.email);
  ensure(email && payload.password && payload.nombre, "email, password y nombre son obligatorios", 400);

  const existing = await findUserIdByEmail(email);
  ensure(!existing, "El email ya existe", 409);

  const id = randomUUID();
  const passwordHash = await hashPassword(payload.password);

  await createUser({
    id,
    email,
    passwordHash,
    nombre: payload.nombre,
    cargo: payload.cargo || "admin",
    ipsId: normalizeIpsId(payload.ipsId ?? payload.ips),
    convenio: payload.convenio || "sin-convenio",
    grupo: payload.grupo || null,
    numDocumento: payload.numDocumento || null,
    activo: 1,
    mustChangePassword: 0,
  });

  return {
    id,
    email,
    nombre: payload.nombre,
    cargo: payload.cargo || "admin",
    convenio: payload.convenio || "sin-convenio",
    grupo: payload.grupo || "",
    numDocumento: payload.numDocumento || "",
  };
}

export async function login(payload) {
  const email = normalizeEmail(payload.email);
  ensure(email && payload.password, "email y password son obligatorios", 400);

  const user = await findUserForLogin(email);
  ensure(user, "Credenciales invalidas", 401);
  ensure(user.activo, "Usuario inactivo", 403);

  const ok = await verifyPassword(payload.password, user.password_hash);
  ensure(ok, "Credenciales invalidas", 401);

  const token = signToken({
    sub: user.id,
    email: user.email,
    cargo: user.cargo,
    ipsId: user.ips_id ?? null,
  });
  return toAuthLoginResponse(user, token);
}

export async function requestPasswordReset(payload) {
  const email = normalizeEmail(payload.email);
  ensure(email, "email es obligatorio", 400);

  const user = await findUserIdByEmail(email);
  if (!user) {
    return { message: "Si el correo existe, se genero un enlace de recuperacion" };
  }

  const token = randomUUID();
  await createPasswordResetToken({ userId: user.id, token });

  if (config.showResetTokenInResponse) {
    return {
      message: "Token de recuperacion generado",
      resetToken: token,
      resetEndpoint: "/api/auth/reset-password",
    };
  }

  return { message: "Solicitud recibida" };
}

export async function resetPassword(payload) {
  ensure(
    payload.token && payload.newPassword && String(payload.newPassword).length >= 6,
    "token y newPassword (minimo 6 caracteres) son obligatorios",
    400
  );

  const resetToken = await findValidPasswordResetToken(payload.token);
  ensure(resetToken, "Token invalido o vencido", 400);

  const passwordHash = await hashPassword(String(payload.newPassword));
  await updateUser(resetToken.user_id, { password_hash: passwordHash });
  await markPasswordResetTokenAsUsed(resetToken.id);

  return { message: "Contrasena actualizada correctamente" };
}

export async function changePassword(userId, payload) {
  ensure(payload.newPassword && String(payload.newPassword).length >= 6, "La contrasena debe tener al menos 6 caracteres", 400);

  const passwordHash = await hashPassword(String(payload.newPassword));
  const affected = await updateUser(userId, {
    password_hash: passwordHash,
    must_change_password: 0,
  });

  if (!affected) {
    throw new AppError("Usuario no encontrado", 404);
  }

  return { message: "Contrasena actualizada correctamente" };
}