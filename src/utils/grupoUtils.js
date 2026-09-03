export const GRUPO_RESERVADO_SISTEMA = "0000";

export function parseGruposUsuario(valor) {
  return String(valor || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function esGrupoReservadoSistema(valor) {
  return String(valor || "").trim() === GRUPO_RESERVADO_SISTEMA;
}

/** Usuarios del grupo 0000 no pueden ingresar ni aparecer en filtros de profesionales. */
export function usuarioPerteneceAGrupoReservado(usuario = {}) {
  return parseGruposUsuario(usuario?.grupo).some((grupo) => esGrupoReservadoSistema(grupo));
}

export const MENSAJE_USUARIO_GRUPO_RESERVADO =
  "Usuario deshabilitado. Comuníquese con el administrador.";
