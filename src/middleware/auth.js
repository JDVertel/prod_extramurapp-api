import { verifyToken } from "../utils/auth.js";
import { findUserById } from "../repositories/user.repository.js";

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
    const dbUser = await findUserById(payload.sub);

    if (!dbUser) {
      return res.status(401).json({ message: "Usuario del token no existe" });
    }

    if (!dbUser.activo) {
      return res.status(403).json({ message: "Usuario inactivo" });
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
