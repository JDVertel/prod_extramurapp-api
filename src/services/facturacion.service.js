import { ensure } from "../utils/app-error.js";
import {
  listDisponiblesFacturacionPorDocumento,
  listDisponiblesFacturacionPorRango,
  listPendientesFacturacion,
} from "../repositories/facturacion.repository.js";

function toBooleanStatus(value) {
  if (value === true || value === 1 || value === "1") return true;
  if (value === false || value === 0 || value === "0") return false;
  if (typeof value === "string") {
    const limpio = value.trim().toLowerCase();
    if (limpio === "true") return true;
    if (limpio === "false") return false;
  }
  return Boolean(value);
}

function serializeDateTimeOutput(value) {
  if (value === null || value === undefined || value === "") return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  return value;
}

function parseJsonMaybe(value) {
  if (value === null || value === undefined || value === "") return value;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch (_) {
    return value;
  }
}

function mapEncuestaFacturacion(row = {}) {
  const barrioRaw = row.barrio_vereda_comuna ?? row.barrioVeredacomuna;
  let barrioVeredacomuna = parseJsonMaybe(barrioRaw);
  if (typeof barrioVeredacomuna === "string" && barrioVeredacomuna.trim()) {
    const texto = barrioVeredacomuna.trim();
    barrioVeredacomuna = { comuna: texto, barrio: texto };
  }

  const poblacionRiesgo = parseJsonMaybe(row.poblacion_riesgo ?? row.poblacionRiesgo);
  const cupsTotal = Number(row.cups_total || 0);
  const cupsConFactura = Number(row.cups_con_factura || 0);
  const allFacturasVacias =
    row.cups_total === undefined
      ? undefined
      : cupsTotal === 0 || cupsConFactura === 0;

  return {
    id: row.id,
    tiporegistro: row.tiporegistro,
    ipsId: row.ips_id ?? row.ipsId,
    idEncuestador: row.id_encuestador ?? row.idEncuestador,
    idMedicoAtiende: row.id_medico_atiende ?? row.idMedicoAtiende,
    idEnfermeroAtiende: row.id_enfermero_atiende ?? row.idEnfermeroAtiende,
    idPsicologoAtiende: row.id_psicologo_atiende ?? row.idPsicologoAtiende,
    idTsocialAtiende: row.id_tsocial_atiende ?? row.idTsocialAtiende,
    idNutricionistaAtiende: row.id_nutricionista_atiende ?? row.idNutricionistaAtiende,
    idHigienistaOralAtiende: row.id_higienista_oral_atiende ?? row.idHigienistaOralAtiende,
    convenio: row.convenio,
    eps: row.eps,
    regimen: row.regimen,
    grupo: row.grupo,
    idEncuesta: row.id_encuesta ?? row.idEncuesta ?? row.id,
    nombre1: row.nombre1,
    nombre2: row.nombre2,
    apellido1: row.apellido1,
    apellido2: row.apellido2,
    tipodoc: row.tipodoc,
    numdoc: row.numdoc,
    sexo: row.sexo,
    fechaNac: row.fecha_nac ?? row.fechaNac,
    direccion: row.direccion,
    telefono: row.telefono,
    barrioVeredacomuna,
    poblacionRiesgo,
    requiereRemision: row.requiere_remision ?? row.requiereRemision,
    fecha: row.fecha,
    fechavisita: serializeDateTimeOutput(row.fecha_visita ?? row.fechavisita),
    fechagestEnfermera: serializeDateTimeOutput(row.fecha_gest_enfermera ?? row.fechagestEnfermera),
    fechagestMedica: serializeDateTimeOutput(row.fecha_gest_medica ?? row.fechagestMedica),
    fechagestAuxiliar: serializeDateTimeOutput(row.fecha_gest_auxiliar ?? row.fechagestAuxiliar),
    FechaFacturacion: serializeDateTimeOutput(row.fecha_facturacion ?? row.FechaFacturacion),
    fechaFacturacion: serializeDateTimeOutput(row.fecha_facturacion ?? row.fechaFacturacion),
    asigfact: row.asig_fact ?? row.asigfact ?? null,
    asig_fact: row.asig_fact ?? row.asigfact ?? null,
    status_gest_aux: toBooleanStatus(row.status_gest_aux),
    status_gest_medica: toBooleanStatus(row.status_gest_medica),
    status_gest_enfermera: toBooleanStatus(row.status_gest_enfermera),
    status_visita: toBooleanStatus(row.status_visita),
    status_caracterizacion: toBooleanStatus(row.status_caracterizacion),
    status_facturacion: toBooleanStatus(row.status_facturacion),
    tipoActividad: { tipoActividad: {} },
    ...(allFacturasVacias === undefined ? {} : { allFacturasVacias }),
  };
}

function resolveActorIpsId(actor) {
  if (actor?.cargo === "superusuario") return null;
  return String(actor?.ipsId ?? actor?.ips_id ?? "").trim() || null;
}

export async function getPendientesFacturacion(query = {}, actor = null) {
  const idFacturador = String(query.idFacturador ?? query.iduser ?? query.idUsuario ?? "").trim();
  ensure(idFacturador, "idFacturador es obligatorio", 400);

  const rows = await listPendientesFacturacion({
    idFacturador,
    convenio: query.convenio,
    gruposFacturador: query.gruposFacturador ?? query.grupos,
    ipsId: resolveActorIpsId(actor),
    limit: query.limit,
  });

  return rows.map(mapEncuestaFacturacion);
}

export async function getDisponiblesFacturacionPorRango(query = {}, actor = null) {
  const fechaInicio = String(query.fechaInicio ?? query.finicial ?? "").trim();
  const fechaFin = String(query.fechaFin ?? query.ffinal ?? "").trim();
  ensure(fechaInicio && fechaFin, "fechaInicio y fechaFin son obligatorias", 400);

  const rows = await listDisponiblesFacturacionPorRango({
    fechaInicio,
    fechaFin,
    convenio: query.convenio,
    gruposFacturador: query.gruposFacturador ?? query.grupos,
    ipsId: resolveActorIpsId(actor),
    limit: query.limit,
  });

  return rows.map(mapEncuestaFacturacion);
}

export async function getDisponiblesFacturacionPorDocumento(query = {}, actor = null) {
  const tipodoc = String(query.tipodoc ?? "").trim();
  const numdoc = String(query.numdoc ?? "").trim();
  ensure(tipodoc && numdoc, "tipodoc y numdoc son obligatorios", 400);

  const rows = await listDisponiblesFacturacionPorDocumento({
    tipodoc,
    numdoc,
    convenio: query.convenio,
    gruposFacturador: query.gruposFacturador ?? query.grupos,
    ipsId: resolveActorIpsId(actor),
    limit: query.limit,
  });

  return rows.map(mapEncuestaFacturacion);
}
