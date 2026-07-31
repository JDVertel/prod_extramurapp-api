import { ensure } from "../utils/app-error.js";
import {
  listFacturacionProfesionalCerrada,
  resolveProfessionalReportRole,
} from "../repositories/informes.repository.js";
import { listAsignacionCupsByEncuestaIds } from "../repositories/module.repository.js";

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_BULK_ENCUESTA_IDS = 2000;

function normalizeDocument(value) {
  return String(value ?? "").trim();
}

function normalizeCargo(value) {
  return String(value || "").trim().toLowerCase();
}

function isAdminActor(actor) {
  const cargo = normalizeCargo(actor?.cargo);
  return cargo === "admin" || cargo === "administrador" || cargo === "superusuario";
}

function isSuperUser(actor) {
  return normalizeCargo(actor?.cargo) === "superusuario";
}

export async function getFacturacionProfesionalCerrada(query = {}, actor = null) {
  ensure(actor, "Usuario autenticado requerido", 401);

  const fechaInicio = String(query.fechaInicio || "").trim();
  const fechaFin = String(query.fechaFin || "").trim();

  ensure(DATE_ONLY_RE.test(fechaInicio), "Debe enviar fechaInicio en formato YYYY-MM-DD", 400);
  ensure(DATE_ONLY_RE.test(fechaFin), "Debe enviar fechaFin en formato YYYY-MM-DD", 400);
  ensure(fechaInicio <= fechaFin, "La fecha de inicio no puede ser mayor que la fecha fin", 400);

  const canQueryOtherProfessional = isAdminActor(actor);
  const cargo = canQueryOtherProfessional ? (query.cargo || actor?.cargo) : actor?.cargo;
  const documentoProfesional = normalizeDocument(
    canQueryOtherProfessional ? (query.idempleado || actor?.numDocumento) : actor?.numDocumento
  );
  const nombreProfesional = String(
    canQueryOtherProfessional ? (query.nombre || actor?.nombre || "") : (actor?.nombre || "")
  ).trim();
  const roleConfig = resolveProfessionalReportRole(cargo);

  ensure(roleConfig, "Cargo no soportado para este informe", 403);
  ensure(documentoProfesional, "El usuario no tiene documento asociado para consultar el informe", 400);

  const rows = await listFacturacionProfesionalCerrada({
    fechaInicio,
    fechaFin,
    documentoProfesional,
    nombreProfesional,
    roleConfig,
    ipsId: isSuperUser(actor) ? null : actor?.ipsId,
  });

  const pacientes = new Set(rows.map((row) => String(row.encuestaId || "")).filter(Boolean));

  return {
    rows,
    resumen: {
      totalPacientes: pacientes.size,
      totalCups: rows.length,
    },
  };
}

export async function getAsignacionesCupsBulk(payload = {}, actor = null) {
  ensure(actor, "Usuario autenticado requerido", 401);

  const rawIds = Array.isArray(payload?.encuestaIds)
    ? payload.encuestaIds
    : Array.isArray(payload?.ids)
      ? payload.ids
      : [];

  const encuestaIds = Array.from(
    new Set(rawIds.map((id) => String(id || "").trim()).filter(Boolean))
  ).slice(0, MAX_BULK_ENCUESTA_IDS);

  if (!encuestaIds.length) {
    return { asignaciones: {} };
  }

  const groupedCups = await listAsignacionCupsByEncuestaIds(encuestaIds);
  const asignaciones = {};

  encuestaIds.forEach((encuestaId) => {
    asignaciones[encuestaId] = {
      cups: groupedCups[encuestaId] || {},
    };
  });

  return { asignaciones };
}
