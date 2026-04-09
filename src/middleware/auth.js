import { verifyToken } from "../utils/auth.js";
import { findUserById } from "../repositories/user.repository.js";

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : req.query?.auth;

  if (!token) {
    return res.status(401).json({ message: "Token requerido" });
  }

  try {
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
      convenio: dbUser.convenio,
      ipsId: dbUser.ips_id,
      numDocumento: dbUser.num_documento,
    };

    return next();
  } catch (error) {
    return res.status(401).json({ message: "Token invalido o expirado" });
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
