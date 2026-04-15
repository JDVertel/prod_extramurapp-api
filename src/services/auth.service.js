import { randomUUID } from "node:crypto";
import { config } from "../utils/config.js";
import { AppError, ensure } from "../utils/app-error.js";
import { hashPassword, signToken, verifyPassword } from "../utils/auth.js";
import { normalizeEmail, toAuthLoginResponse } from "../models/user.model.js";
import {
  createPasswordResetToken,
  ensureLoginSecurityColumns,
  createUser,
  findUserCredentialsById,
  findUserForLogin,
  findUserIdByEmail,
  findValidPasswordResetToken,
  markPasswordResetTokenAsUsed,
  updateUser,
} from "../repositories/user.repository.js";

const MAX_LOGIN_ATTEMPTS = 3;

function getLockDurationMinutes(nextLevel) {
  if (nextLevel === 1) return 30;
  if (nextLevel === 2) return 60;
  return null;
}

function toDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

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

  await ensureLoginSecurityColumns();

  const user = await findUserForLogin(email);
  ensure(user, "Credenciales invalidas", 401);
  ensure(user.activo, "Usuario inactivo", 403);

  const now = new Date();
  const lockLevel = Number(user.lock_level || 0);
  const lockedUntil = toDate(user.locked_until);
  const isLocked = Boolean(user.is_locked);

  if (isLocked && lockLevel >= 3 && !lockedUntil) {
    throw new AppError("Usuario bloqueado de forma permanente. Contacta al administrador.", 423, {
      blocked: true,
      permanent: true,
      attemptsRemaining: 0,
    });
  }

  if (isLocked && lockedUntil && lockedUntil > now) {
    const msRemaining = lockedUntil.getTime() - now.getTime();
    const minutesRemaining = Math.max(1, Math.ceil(msRemaining / 60000));
    throw new AppError(`Usuario bloqueado temporalmente. Intenta de nuevo en ${minutesRemaining} minuto(s).`, 423, {
      blocked: true,
      permanent: false,
      minutesRemaining,
      attemptsRemaining: 0,
    });
  }

  if (isLocked && (!lockedUntil || lockedUntil <= now)) {
    await updateUser(user.id, {
      is_locked: 0,
      locked_until: null,
      failed_login_attempts: 0,
    });
    user.is_locked = 0;
    user.locked_until = null;
    user.failed_login_attempts = 0;
  }

  const ok = await verifyPassword(payload.password, user.password_hash);
  if (!ok) {
    const currentAttempts = Number(user.failed_login_attempts || 0);
    const nextAttempts = currentAttempts + 1;

    if (nextAttempts < MAX_LOGIN_ATTEMPTS) {
      await updateUser(user.id, { failed_login_attempts: nextAttempts });
      const attemptsRemaining = MAX_LOGIN_ATTEMPTS - nextAttempts;
      throw new AppError(
        `Credenciales invalidas. Te quedan ${attemptsRemaining} intento(s) antes del bloqueo.`,
        401,
        {
          attemptsRemaining,
          maxAttempts: MAX_LOGIN_ATTEMPTS,
          blocked: false,
        }
      );
    }

    const nextLockLevel = lockLevel + 1;
    const durationMinutes = getLockDurationMinutes(nextLockLevel);

    if (!durationMinutes) {
      await updateUser(user.id, {
        is_locked: 1,
        lock_level: 3,
        locked_until: null,
        failed_login_attempts: 0,
      });

      throw new AppError("Usuario bloqueado de forma permanente. Contacta al administrador.", 423, {
        blocked: true,
        permanent: true,
        attemptsRemaining: 0,
        maxAttempts: MAX_LOGIN_ATTEMPTS,
      });
    }

    const lockedUntilDate = new Date(now.getTime() + durationMinutes * 60000);
    const lockedUntil = lockedUntilDate.toISOString().slice(0, 19).replace("T", " ");

    await updateUser(user.id, {
      is_locked: 1,
      lock_level: nextLockLevel,
      locked_until: lockedUntil,
      failed_login_attempts: 0,
    });

    throw new AppError(
      `Usuario bloqueado temporalmente por ${durationMinutes} minuto(s). Contacta al administrador si necesitas acceso inmediato.`,
      423,
      {
        blocked: true,
        permanent: false,
        minutesRemaining: durationMinutes,
        attemptsRemaining: 0,
        maxAttempts: MAX_LOGIN_ATTEMPTS,
      }
    );
  }

  await updateUser(user.id, {
    failed_login_attempts: 0,
    is_locked: 0,
    locked_until: null,
  });

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

  const user = await findUserCredentialsById(userId);
  if (!user) {
    throw new AppError("Usuario no encontrado", 404);
  }

  if (!Boolean(user.must_change_password)) {
    ensure(payload.currentPassword, "La contrasena actual es obligatoria", 400);

    const currentPasswordIsValid = await verifyPassword(String(payload.currentPassword), user.password_hash);
    ensure(currentPasswordIsValid, "La contrasena actual no es correcta", 401);
  }

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