import { ensure } from "../utils/app-error.js";
import {
  cerrarDepuracionEncuestas,
  listDisponiblesFacturacionPorDocumento,
  listDisponiblesFacturacionPorRango,
  listHistorialFacturacion,
  listInformeCerradosFacturacion,
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
  const facturacionIncompleta = cupsTotal > 0 && cupsConFactura > 0 && cupsConFactura < cupsTotal;

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
    cupsTotal,
    cupsConFactura,
    facturacionIncompleta,
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

export async function getHistorialFacturacion(query = {}, actor = null) {
  const idFacturador = String(query.idFacturador ?? query.iduser ?? query.idUsuario ?? "").trim();
  const fechaInicio = String(query.fechaInicio ?? query.finicial ?? "").trim();
  const fechaFin = String(query.fechaFin ?? query.ffinal ?? "").trim();
  ensure(idFacturador, "idFacturador es obligatorio", 400);
  ensure(fechaInicio && fechaFin, "fechaInicio y fechaFin son obligatorias", 400);

  const rows = await listHistorialFacturacion({
    idFacturador,
    fechaInicio,
    fechaFin,
    convenio: query.convenio,
    gruposFacturador: query.gruposFacturador ?? query.grupos,
    ipsId: resolveActorIpsId(actor),
    limit: query.limit,
  });

  return rows.map(mapEncuestaFacturacion);
}

function esCupFacturado(row = {}) {
  return toBooleanStatus(row.facturado) && String(row.factNum || "").trim().length > 0;
}

function etiquetaSinDato(valor, etiqueta = "Sin dato") {
  const texto = String(valor || "").trim();
  return texto || etiqueta;
}

function crearAcumulador(clave, etiqueta = clave) {
  return {
    clave,
    etiqueta,
    pacientes: new Set(),
    cupsRegistrados: 0,
    cupsFacturados: 0,
    cantidad: 0,
    facturas: new Set(),
  };
}

function finalizarAcumulador(item = {}) {
  return {
    clave: item.clave,
    etiqueta: item.etiqueta,
    pacientes: item.pacientes?.size || 0,
    cupsRegistrados: item.cupsRegistrados || 0,
    cupsFacturados: item.cupsFacturados || 0,
    cantidad: Number(item.cantidad || 0),
    facturas: item.facturas?.size || 0,
  };
}

function buildInformeResumenCuentas(rows = [], periodo = {}) {
  const totales = {
    pacientesCerrados: new Set(),
    cupsRegistrados: 0,
    cupsFacturados: 0,
    cantidadCups: 0,
    facturasEmitidas: new Set(),
  };

  const mapas = {
    convenio: new Map(),
    eps: new Map(),
    actividad: new Map(),
    cups: new Map(),
    dia: new Map(),
  };

  const obtenerGrupo = (tipo, clave, etiqueta) => {
    const key = String(clave || "").trim() || "sin-dato";
    if (!mapas[tipo].has(key)) {
      mapas[tipo].set(key, crearAcumulador(key, etiqueta || clave));
    }
    return mapas[tipo].get(key);
  };

  rows.forEach((row) => {
    const encuestaId = String(row.encuestaId || "").trim();
    if (!encuestaId) return;

    totales.pacientesCerrados.add(encuestaId);

    const convenio = etiquetaSinDato(row.convenio, "Sin convenio");
    const eps = etiquetaSinDato(row.eps, "Sin EPS");
    const actividad = etiquetaSinDato(row.actividadNombre || row.actividadId, "Sin actividad");
    const fechaDia = String(row.fechaCierrePaciente || "").slice(0, 10) || "Sin fecha";

    [obtenerGrupo("convenio", convenio, convenio),
      obtenerGrupo("eps", eps, eps),
      obtenerGrupo("actividad", actividad, actividad),
      obtenerGrupo("dia", fechaDia, fechaDia)]
      .forEach((grupo) => grupo.pacientes.add(encuestaId));

    if (!row.asignacionCupId) return;

    const cantidad = Number(row.cantidad || 0);
    const cupsCodigo = etiquetaSinDato(row.cupsCodigo, "Sin codigo");
    const cupsNombre = etiquetaSinDato(row.cupsNombre, "Sin nombre CUPS");
    const cupsEtiqueta = `${cupsCodigo} - ${cupsNombre}`;
    const grupoCups = obtenerGrupo("cups", `${cupsCodigo}::${cupsNombre}`, cupsEtiqueta);
    const gruposCup = [
      obtenerGrupo("convenio", convenio, convenio),
      obtenerGrupo("eps", eps, eps),
      obtenerGrupo("actividad", actividad, actividad),
      grupoCups,
      obtenerGrupo("dia", fechaDia, fechaDia),
    ];

    totales.cupsRegistrados += 1;
    totales.cantidadCups += cantidad;

    gruposCup.forEach((grupo) => {
      grupo.cupsRegistrados += 1;
      grupo.cantidad += cantidad;
    });

    if (esCupFacturado(row)) {
      totales.cupsFacturados += 1;
      const factura = String(row.factNum || "").trim();
      if (factura) totales.facturasEmitidas.add(factura);

      gruposCup.forEach((grupo) => {
        grupo.cupsFacturados += 1;
        if (factura) grupo.facturas.add(factura);
      });
    }
  });

  const ordenarDesc = (a, b) =>
    b.pacientes - a.pacientes
    || b.cupsFacturados - a.cupsFacturados
    || b.cantidad - a.cantidad
    || String(a.etiqueta).localeCompare(String(b.etiqueta), "es");

  const serializar = (map) => Array.from(map.values()).map(finalizarAcumulador).sort(ordenarDesc);

  return {
    periodo,
    totales: {
      pacientesCerrados: totales.pacientesCerrados.size,
      cupsRegistrados: totales.cupsRegistrados,
      cupsFacturados: totales.cupsFacturados,
      cantidadCups: totales.cantidadCups,
      facturasEmitidas: totales.facturasEmitidas.size,
    },
    porConvenio: serializar(mapas.convenio),
    porEps: serializar(mapas.eps),
    porActividad: serializar(mapas.actividad),
    porCups: serializar(mapas.cups),
    porDia: serializar(mapas.dia).sort((a, b) => String(a.clave).localeCompare(String(b.clave))),
  };
}

export async function getInformeCerradosFacturacion(query = {}, actor = null) {
  const idFacturador = String(query.idFacturador ?? query.iduser ?? query.idUsuario ?? "").trim();
  const fechaInicio = String(query.fechaInicio ?? query.finicial ?? "").trim();
  const fechaFin = String(query.fechaFin ?? query.ffinal ?? "").trim();
  ensure(idFacturador, "idFacturador es obligatorio", 400);
  ensure(fechaInicio && fechaFin, "fechaInicio y fechaFin son obligatorias", 400);

  const rows = await listInformeCerradosFacturacion({
    idFacturador,
    fechaInicio,
    fechaFin,
    convenio: query.convenio,
    gruposFacturador: query.gruposFacturador ?? query.grupos,
    ipsId: resolveActorIpsId(actor),
    limit: query.limit,
  });

  return buildInformeResumenCuentas(rows, { fechaInicio, fechaFin });
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

export async function cerrarDepuracionMasiva(payload = {}, actor = null) {
  const encuestaIds = Array.isArray(payload.encuestaIds) ? payload.encuestaIds : [];
  const idFacturador = String(
    payload.idFacturador ?? payload.iduser ?? actor?.numDocumento ?? ""
  ).trim();

  ensure(encuestaIds.length > 0, "Debe indicar al menos un paciente", 400);
  ensure(idFacturador, "idFacturador es obligatorio", 400);
  ensure(encuestaIds.length <= 200, "Maximo 200 pacientes por operacion", 400);

  return cerrarDepuracionEncuestas({
    encuestaIds,
    idFacturador,
    ipsId: resolveActorIpsId(actor),
  });
}
