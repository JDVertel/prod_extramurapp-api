import { pool } from "../utils/database.js";

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const ROLE_CONFIG = {
  "auxiliar de enfermeria": {
    encuestaColumn: "id_encuestador",
    cupKeys: ["auxiliar de enfermeria", "auxiliar de enfermería", "auxiliar"],
  },
  medico: {
    encuestaColumn: "id_medico_atiende",
    cupKeys: ["medico", "médico"],
  },
  enfermero: {
    encuestaColumn: "id_enfermero_atiende",
    cupKeys: ["enfermero", "enfermero jefe", "jefe"],
  },
  jefe: {
    encuestaColumn: "id_enfermero_atiende",
    cupKeys: ["enfermero", "enfermero jefe", "jefe"],
  },
  psicologo: {
    encuestaColumn: "id_psicologo_atiende",
    cupKeys: ["psicologo", "psicólogo"],
  },
  tsocial: {
    encuestaColumn: "id_tsocial_atiende",
    cupKeys: ["tsocial", "trabajador social", "social"],
  },
  nutricionista: {
    encuestaColumn: "id_nutricionista_atiende",
    cupKeys: ["nutricionista", "nutricion", "nutrición"],
  },
  "higienista oral": {
    encuestaColumn: "id_higienista_oral_atiende",
    cupKeys: ["higienista oral", "higienista", "oral"],
  },
};

export function resolveProfessionalReportRole(cargo) {
  const normalizedCargo = normalizeText(cargo);

  if (normalizedCargo.includes("auxiliar") && normalizedCargo.includes("enfermeria")) {
    return ROLE_CONFIG["auxiliar de enfermeria"];
  }
  if (normalizedCargo.includes("medico")) {
    return ROLE_CONFIG.medico;
  }
  if (normalizedCargo.includes("enfermero") || normalizedCargo.includes("jefe")) {
    return ROLE_CONFIG.enfermero;
  }
  if (normalizedCargo.includes("psicologo")) {
    return ROLE_CONFIG.psicologo;
  }
  if (normalizedCargo.includes("tsocial") || normalizedCargo.includes("trabajador social")) {
    return ROLE_CONFIG.tsocial;
  }
  if (normalizedCargo.includes("nutricionista") || normalizedCargo.includes("nutricion")) {
    return ROLE_CONFIG.nutricionista;
  }
  if (normalizedCargo.includes("higienista") && normalizedCargo.includes("oral")) {
    return ROLE_CONFIG["higienista oral"];
  }

  return null;
}

/**
 * Base para indicadores de salud: una fila por CUPS asignado (o una sola fila sin CUPS)
 * de cada encuesta con `fecha` dentro del rango.
 */
export async function listIndicadoresSaludBase({
  fechaInicio,
  fechaFin,
  convenio = "",
  ipsId = null,
} = {}) {
  const whereParts = [
    "e.fecha IS NOT NULL",
    "DATE(e.fecha) >= ?",
    "DATE(e.fecha) <= ?",
  ];
  const params = [fechaInicio, fechaFin];

  const convenioLimpio = String(convenio || "").trim();
  if (convenioLimpio) {
    whereParts.push("LOWER(TRIM(COALESCE(e.convenio, ''))) = LOWER(TRIM(?))");
    params.push(convenioLimpio);
  }

  if (ipsId) {
    whereParts.push("(e.ips_id = ? OR e.ips_id IS NULL OR e.ips_id = '')");
    params.push(ipsId);
  }

  const [rows] = await pool.query(
    `SELECT
       e.id AS encuestaId,
       e.convenio,
       e.eps,
       e.grupo,
       e.nombre1,
       e.nombre2,
       e.apellido1,
       e.apellido2,
       e.tipodoc,
       e.numdoc,
       e.sexo,
       e.fecha_nac AS fechaNac,
       e.poblacion_riesgo AS poblacionRiesgo,
       e.fecha,
       e.fecha_visita AS fechaVisita,
       c.antecedentes,
       c.evacunal,
       ac.id AS asignacionCupId,
       ac.cups_codigo AS cupsCodigo,
       ac.cups_nombre AS cupsNombre,
       ac.cups_grupo AS cupsGrupo,
       ac.detalle,
       ac.key_ref AS rol,
       ae.nombre AS actividadNombre
     FROM encuestas e
     LEFT JOIN caracterizacion c ON c.encuesta_id = e.id
     LEFT JOIN asignacion_cups ac ON ac.encuesta_id = e.id
     LEFT JOIN actividades_extra ae ON (
       ae.clave COLLATE utf8mb4_unicode_ci = ac.actividad_id COLLATE utf8mb4_unicode_ci
       OR ae.id COLLATE utf8mb4_unicode_ci = ac.actividad_id COLLATE utf8mb4_unicode_ci
     )
     WHERE ${whereParts.join(" AND ")}
     ORDER BY e.fecha ASC, e.id ASC`,
    params
  );

  return rows;
}

export async function listFacturacionProfesionalCerrada({
  fechaInicio,
  fechaFin,
  documentoProfesional,
  nombreProfesional,
  roleConfig,
  ipsId = null,
}) {
  const cupKeyValues = Array.from(
    new Set((roleConfig?.cupKeys || []).map((key) => normalizeText(key)).filter(Boolean))
  );
  const cupKeyPlaceholders = cupKeyValues.map(() => "?").join(", ");
  const whereIps = ipsId ? "AND e.ips_id = ?" : "";
  const params = [
    fechaInicio,
    fechaFin,
    documentoProfesional,
    ...cupKeyValues,
    normalizeText(nombreProfesional),
  ];

  if (ipsId) {
    params.push(ipsId);
  }

  const [rows] = await pool.query(
    `SELECT
       e.id AS encuestaId,
       e.ips_id AS ipsId,
       e.convenio,
       e.eps,
       e.regimen,
       e.grupo,
       e.nombre1,
       e.nombre2,
       e.apellido1,
       e.apellido2,
       TRIM(CONCAT_WS(' ', e.nombre1, e.nombre2, e.apellido1, e.apellido2)) AS pacienteNombre,
       e.tipodoc,
       e.numdoc,
       e.sexo,
       e.fecha_nac AS fechaNac,
       e.direccion,
       e.telefono,
       e.barrio_vereda_comuna AS barrioVeredacomuna,
       e.desplazamiento,
       e.poblacion_riesgo AS poblacionRiesgo,
       e.requiere_remision AS requiereRemision,
       e.fecha,
       e.fecha_visita AS fechaVisita,
       e.fecha_facturacion AS fechaCierreFacturacion,
       ac.id AS asignacionCupId,
       ac.actividad_id AS actividadId,
       ac.cups_id AS cupsId,
       ac.cups_codigo AS cupsCodigo,
       ac.cups_nombre AS cupsNombre,
       ac.cups_grupo AS cupsGrupo,
       ac.cantidad,
       ac.detalle,
       ac.fact_num AS numeroFactura,
       ac.fact_prof AS facturadorId,
       ac.facturado,
       ac.fecha_facturacion AS fechaFacturacionCup,
       ac.key_ref AS profesionalCargoCup,
       ac.nombre_prof AS profesionalNombreCup
     FROM encuestas e
     INNER JOIN asignacion_cups ac ON ac.encuesta_id = e.id
     WHERE e.status_facturacion = 1
       AND e.fecha_facturacion >= ?
       AND e.fecha_facturacion < DATE_ADD(?, INTERVAL 1 DAY)
       AND e.${roleConfig.encuestaColumn} = ?
       AND ac.facturado = 1
       AND COALESCE(TRIM(ac.fact_num), '') <> ''
       AND (
         ${cupKeyPlaceholders ? `LOWER(TRIM(COALESCE(ac.key_ref, ''))) IN (${cupKeyPlaceholders})` : "FALSE"}
         OR LOWER(TRIM(COALESCE(ac.nombre_prof, ''))) = ?
       )
       ${whereIps}
       AND NOT EXISTS (
         SELECT 1
         FROM asignacion_cups ac2
         WHERE ac2.encuesta_id = e.id
           AND (
             COALESCE(ac2.facturado, 0) <> 1
             OR COALESCE(TRIM(ac2.fact_num), '') = ''
           )
       )
     ORDER BY e.fecha_facturacion DESC, pacienteNombre ASC, ac.cups_codigo ASC, ac.cups_nombre ASC`,
    params
  );

  return rows;
}
