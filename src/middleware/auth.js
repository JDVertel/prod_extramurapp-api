import { verifyToken } from "../utils/auth.js";
import { findUserById } from "../repositories/user.repository.js";
import {
  MENSAJE_USUARIO_GRUPO_RESERVADO,
  usuarioPerteneceAGrupoReservado,
} from "../utils/grupoUtils.js";

const AUTH_USER_CACHE_TTL_MS = 45_000;
const authUserCache = new Map();

function getCachedAuthUser(userId) {
  const entry = authUserCache.get(String(userId || ""));
  if (!entry) return null;
  if (Date.now() - entry.at > AUTH_USER_CACHE_TTL_MS) {
    authUserCache.delete(String(userId || ""));
    return null;
  }
  return entry.user;
}

function setCachedAuthUser(user) {
  if (!user?.id) return;
  authUserCache.set(String(user.id), { at: Date.now(), user });
}

/** Invalida caché de auth (usar tras update/delete de usuario). */
export function invalidateAuthUserCache(userId = null) {
  if (!userId) {
    authUserCache.clear();
    return;
  }
  authUserCache.delete(String(userId));
}

/**
 * Middleware JWT. Debe usarse SOLO en rutas protegidas.
 * No aplicar de forma global sobre /auth/login ni otros endpoints públicos.
 */
export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : String(req.query?.auth || "").trim();

    if (!token || token === "null" || token === "undefined") {
      return res.status(401).json({ message: "Token requerido" });
    }

    const payload = verifyToken(token);
    let dbUser = getCachedAuthUser(payload.sub);
    if (!dbUser) {
      dbUser = await findUserById(payload.sub);
      if (dbUser) {
        setCachedAuthUser(dbUser);
      }
    }

    if (!dbUser) {
      return res.status(401).json({ message: "Usuario del token no existe" });
    }

    if (!dbUser.activo) {
      invalidateAuthUserCache(dbUser.id);
      return res.status(403).json({ message: "Usuario inactivo" });
    }

    if (usuarioPerteneceAGrupoReservado(dbUser)) {
      invalidateAuthUserCache(dbUser.id);
      return res.status(403).json({
        message: MENSAJE_USUARIO_GRUPO_RESERVADO,
        detail: { grupoReservado: true, disabled: true },
      });
    }

    req.user = {
      ...payload,
      id: dbUser.id,
      sub: dbUser.id,
      cargo: dbUser.cargo,
      nombre: dbUser.nombre,
      convenio: dbUser.convenio,
      ipsId: dbUser.ips_id,
      numDocumento: dbUser.num_documento,
    };

    return next();
  } catch (error) {
    // Errores JWT → 401; otros fallos inesperados → next(error) para el error handler
    if (error?.name === "JsonWebTokenError" || error?.name === "TokenExpiredError" || error?.name === "NotBeforeError") {
      return res.status(401).json({ message: "Token invalido o expirado" });
    }
    return next(error);
  }
}

export function requireSuperUser(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: "No autenticado" });
  }
  if (req.user.cargo !== "superusuario") {
    return res.status(403).json({ message: "Acceso restringido a superusuario" });
  }
  return next();
}
