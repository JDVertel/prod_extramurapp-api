import { ensure } from "../utils/app-error.js";
import { listIndicadoresSaludBase } from "../repositories/informes.repository.js";

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_DIA = 24 * 60 * 60 * 1000;
const SEMANAS_CAPTACION_TEMPRANA = 12;

function normalizar(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function parseFecha(valor) {
  if (!valor) return null;
  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime()) ? null : valor;
  }
  const texto = String(valor).trim();
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const latam = texto.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
  if (latam) return new Date(Number(latam[3]), Number(latam[2]) - 1, Number(latam[1]));
  const fecha = new Date(texto);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function formatearFecha(fecha) {
  if (!fecha) return "";
  const yyyy = fecha.getFullYear();
  const mm = String(fecha.getMonth() + 1).padStart(2, "0");
  const dd = String(fecha.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function edadEnMeses(fechaNac, fechaRef) {
  if (!fechaNac || !fechaRef) return null;
  let meses = (fechaRef.getFullYear() - fechaNac.getFullYear()) * 12
    + (fechaRef.getMonth() - fechaNac.getMonth());
  if (fechaRef.getDate() < fechaNac.getDate()) meses -= 1;
  return meses >= 0 ? meses : null;
}

function normalizarSexo(valor) {
  const texto = normalizar(valor);
  if (!texto) return "";
  if (texto.startsWith("f") || texto.startsWith("mujer")) return "F";
  if (texto.startsWith("m") && !texto.startsWith("mujer")) return "M";
  if (texto.startsWith("h")) return "M";
  return "";
}

function parseJson(valor) {
  if (!valor || typeof valor === "object") return valor || null;
  try {
    return JSON.parse(valor);
  } catch {
    return null;
  }
}

function extraerFum(antecedentes) {
  const data = parseJson(antecedentes);
  if (!data || typeof data !== "object") return null;
  const gineco = data.ginecobstetrico || data.Ginecobstetrico || null;
  return parseFecha(gineco?.fechaFum || gineco?.fecha_fum || data.fechaFum || null);
}

/* ---------------------------------- Matchers de CUPS ---------------------------------- */

const RE = {
  vacuna: /vacun|inmuniz|biologico|\bdosis\b/,
  vih: /\bvih\b|\bhiv\b|inmunodeficiencia humana/,
  sifilis: /sifilis|treponem|\bvdrl\b|\brpr\b|reagina/,
  hepatitisB: /hepatitis b\b|hepatitis tipo b|antigeno de superficie|\bhbsag\b/,
  prenatal: /prenatal|gestante|gestacion|embarazada/,
  noProcedimiento: /educacion|remision|induccion|demanda inducida|caracterizacion|asesoria|consejeria/,
  bcg: /\bbcg\b|tuberculosis/,
  pentavalente: /pentavalente|hexavalente|haemophilus.*difteri|difteri.*haemophilus/,
  srp: /triple viral|\bsrp\b|sarampion|rubeola|paperas/,
  dpt: /\bdpt\b|\bdtp\b|\bdpat\b|tos ?ferina|pertussis|pentavalente|hexavalente|haemophilus.*difteri/,
  polio: /polio|\bvop\b|\bvip\b|\bivp\b|hexavalente/,
  vphVacuna: /papiloma|\bvph\b|\bhpv\b/,
  td: /\btd\b|toxoide|tetan|difteri/,
  tdExcluir: /tos ?ferina|pertussis|\bdpt\b|\bdtp\b|pentavalente|hexavalente|haemophilus/,
  cervix: /citologia|cervico ?uterin|cuello uterino|papiloma|\bvph\b|\bhpv\b|inspeccion visual/,
  mamografia: /mamograf/,
  psa: /antigeno (especifico )?(de )?prosta|antigeno prostatico|\bpsa\b/,
  tactoRectal: /tacto rectal/,
  consulta: /consulta|valoracion|atencion/,
  enfermeria: /enfermer/,
  medicinaGeneral: /medicina general|medico general/,
  pediatria: /pediatr/,
  medicinaFamiliar: /medicina familiar|medico familiar/,
};

const esVacuna = (cup) => RE.vacuna.test(cup.texto);
const esPrueba = (cup) => !esVacuna(cup) && !RE.noProcedimiento.test(cup.texto);
const cupCumple = {
  vih: (cup) => esPrueba(cup) && RE.vih.test(cup.texto),
  sifilis: (cup) => esPrueba(cup) && RE.sifilis.test(cup.texto),
  hepatitisB: (cup) => esPrueba(cup) && RE.hepatitisB.test(cup.texto),
  prenatal: (cup) => !RE.noProcedimiento.test(cup.texto) && RE.prenatal.test(cup.texto),
  bcg: (cup) => esVacuna(cup) && RE.bcg.test(cup.texto),
  pentavalente: (cup) => esVacuna(cup) && RE.pentavalente.test(cup.texto),
  srp: (cup) => esVacuna(cup) && RE.srp.test(cup.texto),
  dpt: (cup) => esVacuna(cup) && RE.dpt.test(cup.texto),
  polio: (cup) => esVacuna(cup) && RE.polio.test(cup.texto),
  vphVacuna: (cup) => esVacuna(cup) && RE.vphVacuna.test(cup.texto),
  td: (cup) => esVacuna(cup) && RE.td.test(cup.texto) && !RE.tdExcluir.test(cup.texto),
  cervix: (cup) => esPrueba(cup) && RE.cervix.test(cup.texto),
  mamografia: (cup) => esPrueba(cup) && RE.mamografia.test(cup.texto),
  psa: (cup) => esPrueba(cup) && RE.psa.test(cup.texto),
  tactoRectal: (cup) => esPrueba(cup) && RE.tactoRectal.test(cup.texto),
};

/** Consulta por las profesiones permitidas (por descripción del CUPS o por el rol que lo registró). */
function crearMatcherAtencion(profesiones = []) {
  return (cup) => {
    if (!esPrueba(cup)) return false;
    const texto = cup.texto;
    const esConsulta = RE.consulta.test(texto);
    const porDescripcion = esConsulta && profesiones.some((p) => RE[p].test(texto));
    if (porDescripcion) return true;

    if (!esConsulta) return false;
    const rol = cup.rol;
    if (profesiones.includes("medicinaGeneral") && rol.includes("medico")) return true;
    if (profesiones.includes("enfermeria") && rol.includes("enfermer")) return true;
    return false;
  };
}

const ATENCION_PRIMERA_INFANCIA_INFANCIA = crearMatcherAtencion([
  "enfermeria", "medicinaGeneral", "pediatria", "medicinaFamiliar",
]);
const ATENCION_ADOLESCENCIA = crearMatcherAtencion(["enfermeria", "medicinaGeneral", "medicinaFamiliar"]);
const ATENCION_ADULTOS = crearMatcherAtencion(["medicinaGeneral", "medicinaFamiliar"]);

const FUENTE_CUPS = "CUPS";
const FUENTE_CARACTERIZACION = "Caracterización";

/** Todos los criterios deben tener al menos un CUPS que cumpla (pueden ser CUPS distintos). */
function cumpleTodos(persona, criterios = []) {
  const evidencia = [];
  for (const criterio of criterios) {
    const cup = persona.cups.find(criterio);
    if (!cup) return { cumple: false, evidencia: [] };
    evidencia.push(cup.etiqueta);
  }
  return { cumple: true, evidencia: Array.from(new Set(evidencia)), fuente: FUENTE_CUPS };
}

/** Si no hay CUPS de la vacuna, acepta el esquema vacunal "Completo" registrado en la caracterización. */
function cumpleVacuna(persona, criterios = [], { edadMinimaMeses = 0 } = {}) {
  const porCups = cumpleTodos(persona, criterios);
  if (porCups.cumple) return porCups;
  const aplicaEdad = persona.edadMeses !== null && persona.edadMeses >= edadMinimaMeses;
  if (persona.esquemaVacunal === "completo" && aplicaEdad) {
    const fecha = persona.fechaEsquemaVacunal ? ` (${formatearFecha(persona.fechaEsquemaVacunal)})` : "";
    return {
      cumple: true,
      evidencia: [`Caracterización: esquema vacunal Completo${fecha}`],
      fuente: FUENTE_CARACTERIZACION,
    };
  }
  const estado = persona.esquemaVacunal ? `Caracterización: esquema vacunal ${persona.esquemaVacunalTexto}` : "";
  return { cumple: false, evidencia: estado ? [estado] : [] };
}

/* ------------------------------------ Definiciones ------------------------------------ */

const edadAnios = (p) => (p.edadMeses === null ? null : Math.floor(p.edadMeses / 12));
const enRangoAnios = (p, min, max) => {
  const anios = edadAnios(p);
  return anios !== null && anios >= min && anios <= max;
};
const enRangoMeses = (p, min, max) => p.edadMeses !== null && p.edadMeses >= min && p.edadMeses <= max;

const INDICADORES = [
  {
    codigo: "IND01",
    nombre: "Proporción de gestantes con captación temprana al control prenatal",
    poblacion: "Gestantes atendidas en el periodo",
    criterio: `Edad gestacional ≤ ${SEMANAS_CAPTACION_TEMPRANA} semanas (según FUM) en la primera atención del periodo`,
    denominador: (p) => p.gestante,
    numerador: (p) => {
      if (!p.fum || !p.fechaPrimeraAtencion) {
        return { cumple: false, evidencia: [p.fum ? "Sin fecha de atención" : "Sin FUM registrada"] };
      }
      const semanas = Math.floor((p.fechaPrimeraAtencion - p.fum) / MS_DIA / 7);
      return {
        cumple: semanas >= 0 && semanas <= SEMANAS_CAPTACION_TEMPRANA,
        evidencia: [`Caracterización: FUM ${formatearFecha(p.fum)} · ${semanas} semanas`],
        fuente: FUENTE_CARACTERIZACION,
      };
    },
  },
  {
    codigo: "IND02",
    nombre: "Proporción de gestantes con tamizaje para VIH, Sífilis y Hepatitis B",
    poblacion: "Gestantes atendidas en el periodo",
    criterio: "CUPS de prueba para VIH, sífilis y hepatitis B",
    denominador: (p) => p.gestante,
    numerador: (p) => cumpleTodos(p, [cupCumple.vih, cupCumple.sifilis, cupCumple.hepatitisB]),
  },
  {
    codigo: "IND03",
    nombre: "Proporción de gestantes con tamizaje para VIH",
    poblacion: "Gestantes atendidas en el periodo",
    criterio: "CUPS de prueba para VIH",
    denominador: (p) => p.gestante,
    numerador: (p) => cumpleTodos(p, [cupCumple.vih]),
  },
  {
    codigo: "IND04",
    nombre: "Proporción de gestantes con tamizaje para Sífilis",
    poblacion: "Gestantes atendidas en el periodo",
    criterio: "CUPS de prueba para sífilis (treponémica / no treponémica)",
    denominador: (p) => p.gestante,
    numerador: (p) => cumpleTodos(p, [cupCumple.sifilis]),
  },
  {
    codigo: "IND05",
    nombre: "Cobertura de niñas y niños con atención por enfermería, medicina general o especializada en pediatría o medicina familiar de acuerdo con el esquema definido para la primera infancia",
    poblacion: "Niñas y niños de 0 a 5 años",
    criterio: "Consulta por enfermería, medicina general, pediatría o medicina familiar",
    denominador: (p) => enRangoAnios(p, 0, 5),
    numerador: (p) => cumpleTodos(p, [ATENCION_PRIMERA_INFANCIA_INFANCIA]),
  },
  {
    codigo: "IND06",
    nombre: "Cobertura de niñas y niños con atención por enfermería, medicina general o especializada en pediatría o medicina familiar de acuerdo con el esquema definido para la infancia",
    poblacion: "Niñas y niños de 6 a 11 años",
    criterio: "Consulta por enfermería, medicina general, pediatría o medicina familiar",
    denominador: (p) => enRangoAnios(p, 6, 11),
    numerador: (p) => cumpleTodos(p, [ATENCION_PRIMERA_INFANCIA_INFANCIA]),
  },
  {
    codigo: "IND07",
    nombre: "Cobertura de adolescentes con atención por enfermería, medicina general o medicina familiar de acuerdo con el esquema definido para el momento de curso de vida",
    poblacion: "Adolescentes de 12 a 17 años",
    criterio: "Consulta por enfermería, medicina general o medicina familiar",
    denominador: (p) => enRangoAnios(p, 12, 17),
    numerador: (p) => cumpleTodos(p, [ATENCION_ADOLESCENCIA]),
  },
  {
    codigo: "IND08",
    nombre: "Cobertura de jóvenes con atención por medicina general o medicina familiar de acuerdo con el esquema definido para el momento de curso de vida",
    poblacion: "Jóvenes de 18 a 28 años",
    criterio: "Consulta por medicina general o medicina familiar",
    denominador: (p) => enRangoAnios(p, 18, 28),
    numerador: (p) => cumpleTodos(p, [ATENCION_ADULTOS]),
  },
  {
    codigo: "IND09",
    nombre: "Cobertura de adultos con atención por medicina general o medicina familiar de acuerdo con el esquema definido para el momento de curso de vida",
    poblacion: "Adultos de 29 a 59 años",
    criterio: "Consulta por medicina general o medicina familiar",
    denominador: (p) => enRangoAnios(p, 29, 59),
    numerador: (p) => cumpleTodos(p, [ATENCION_ADULTOS]),
  },
  {
    codigo: "IND10",
    nombre: "Cobertura de personas adultas mayores con atención por medicina general o medicina familiar de acuerdo con el esquema definido para el momento de curso de vida",
    poblacion: "Personas de 60 años o más",
    criterio: "Consulta por medicina general o medicina familiar",
    denominador: (p) => enRangoAnios(p, 60, 200),
    numerador: (p) => cumpleTodos(p, [ATENCION_ADULTOS]),
  },
  {
    codigo: "IND11",
    nombre: "Proporción de mujeres entre 25 y 65 años tamizadas para cáncer de cuello uterino con cualquier prueba de tamización",
    poblacion: "Mujeres de 25 a 65 años",
    criterio: "CUPS de citología, prueba ADN-VPH o inspección visual",
    denominador: (p) => p.sexo === "F" && enRangoAnios(p, 25, 65),
    numerador: (p) => cumpleTodos(p, [cupCumple.cervix]),
  },
  {
    codigo: "IND12",
    nombre: "Proporción de mujeres entre 50 y 69 años tamizadas para cáncer de mama con mamografía en los últimos dos años",
    poblacion: "Mujeres de 50 a 69 años",
    criterio: "CUPS de mamografía registrado en el periodo consultado",
    denominador: (p) => p.sexo === "F" && enRangoAnios(p, 50, 69),
    numerador: (p) => cumpleTodos(p, [cupCumple.mamografia]),
  },
  {
    codigo: "IND13",
    nombre: "Proporción de hombres mayores de 50 años con tamizaje de oportunidad para cáncer de próstata (PSA y tacto rectal combinado)",
    poblacion: "Hombres de 50 años o más",
    criterio: "CUPS de antígeno prostático (PSA) y tacto rectal",
    denominador: (p) => p.sexo === "M" && enRangoAnios(p, 50, 200),
    numerador: (p) => cumpleTodos(p, [cupCumple.psa, cupCumple.tactoRectal]),
  },
  {
    codigo: "IND14",
    nombre: "Cobertura de vacunación con BCG en recién nacidos",
    poblacion: "Menores de 1 año",
    criterio: "CUPS de vacuna BCG o esquema vacunal Completo en la caracterización",
    denominador: (p) => enRangoMeses(p, 0, 11),
    numerador: (p) => cumpleVacuna(p, [cupCumple.bcg]),
  },
  {
    codigo: "IND15",
    nombre: "Cobertura de tercera dosis de Pentavalente en menores de 1 año",
    poblacion: "Menores de 1 año",
    criterio: "CUPS de vacuna pentavalente (combinada Haemophilus-DPT-Hepatitis B) o esquema vacunal Completo en la caracterización a partir de los 6 meses",
    denominador: (p) => enRangoMeses(p, 0, 11),
    numerador: (p) => cumpleVacuna(p, [cupCumple.pentavalente], { edadMinimaMeses: 6 }),
  },
  {
    codigo: "IND16",
    nombre: "Cobertura de Triple Viral (SRP) en niños de 1 año",
    poblacion: "Niñas y niños de 12 a 23 meses",
    criterio: "CUPS de vacuna triple viral (SRP) o esquema vacunal Completo en la caracterización",
    denominador: (p) => enRangoMeses(p, 12, 23),
    numerador: (p) => cumpleVacuna(p, [cupCumple.srp]),
  },
  {
    codigo: "IND17",
    nombre: "Cobertura de Primer Refuerzo (DPT y Polio) a los 18 meses",
    poblacion: "Niñas y niños de 18 a 23 meses",
    criterio: "CUPS de vacuna DPT y polio o esquema vacunal Completo en la caracterización",
    denominador: (p) => enRangoMeses(p, 18, 23),
    numerador: (p) => cumpleVacuna(p, [cupCumple.dpt, cupCumple.polio]),
  },
  {
    codigo: "IND18",
    nombre: "Cobertura de Segundo Refuerzo (DPT, Polio y SRP) a los 5 años",
    poblacion: "Niñas y niños de 5 años",
    criterio: "CUPS de vacuna DPT, polio y SRP o esquema vacunal Completo en la caracterización",
    denominador: (p) => enRangoAnios(p, 5, 5),
    numerador: (p) => cumpleVacuna(p, [cupCumple.dpt, cupCumple.polio, cupCumple.srp]),
  },
  {
    codigo: "IND19",
    nombre: "Cobertura de Vacuna contra el Virus del Papiloma Humano (VPH)",
    poblacion: "Niñas y niños de 9 a 17 años",
    criterio: "CUPS de vacuna VPH o esquema vacunal Completo en la caracterización",
    denominador: (p) => enRangoAnios(p, 9, 17),
    numerador: (p) => cumpleVacuna(p, [cupCumple.vphVacuna]),
  },
  {
    codigo: "IND20",
    nombre: "Cobertura de vacunación con Toxoide Tetánico/Diftérico (Td) en mujeres en edad fértil (MEF)",
    poblacion: "Mujeres de 10 a 49 años",
    criterio: "CUPS de vacuna Td / toxoide tetánico-diftérico o esquema vacunal Completo en la caracterización",
    denominador: (p) => p.sexo === "F" && enRangoAnios(p, 10, 49),
    numerador: (p) => cumpleVacuna(p, [cupCumple.td]),
  },
];

/* ------------------------------------ Consolidación ------------------------------------ */

function construirPersonas(rows = []) {
  const personas = new Map();

  rows.forEach((row) => {
    const tipodoc = String(row.tipodoc || "").trim();
    const numdoc = String(row.numdoc || "").trim();
    const clave = numdoc ? `${normalizar(tipodoc)}|${normalizar(numdoc)}` : `enc|${row.encuestaId}`;
    const fechaAtencion = parseFecha(row.fechaVisita) || parseFecha(row.fecha);

    let persona = personas.get(clave);
    if (!persona) {
      persona = {
        clave,
        paciente: [row.nombre1, row.nombre2, row.apellido1, row.apellido2]
          .map((parte) => String(parte || "").trim())
          .filter(Boolean)
          .join(" ") || "Sin nombre",
        documento: [tipodoc, numdoc].filter(Boolean).join("-"),
        sexo: normalizarSexo(row.sexo),
        fechaNac: parseFecha(row.fechaNac),
        convenio: String(row.convenio || "").trim(),
        eps: String(row.eps || "").trim(),
        gestanteDeclarada: false,
        fum: null,
        esquemaVacunal: "",
        esquemaVacunalTexto: "",
        fechaEsquemaVacunal: null,
        fechaPrimeraAtencion: null,
        fechaUltimaAtencion: null,
        encuestas: new Set(),
        cups: [],
        cupsVistos: new Set(),
      };
      personas.set(clave, persona);
    }

    persona.encuestas.add(String(row.encuestaId));
    if (normalizar(row.poblacionRiesgo).includes("gestante")) {
      persona.gestanteDeclarada = true;
    }
    const fum = extraerFum(row.antecedentes);
    if (fum && (!persona.fum || fum > persona.fum)) persona.fum = fum;

    const esquemaVacunal = normalizar(row.evacunal);
    const esquemaMasReciente = !persona.esquemaVacunal
      || (fechaAtencion && (!persona.fechaEsquemaVacunal || fechaAtencion >= persona.fechaEsquemaVacunal));
    if (esquemaVacunal && esquemaMasReciente) {
      persona.esquemaVacunal = esquemaVacunal;
      persona.esquemaVacunalTexto = String(row.evacunal).trim();
      persona.fechaEsquemaVacunal = fechaAtencion;
    }

    if (fechaAtencion) {
      if (!persona.fechaPrimeraAtencion || fechaAtencion < persona.fechaPrimeraAtencion) {
        persona.fechaPrimeraAtencion = fechaAtencion;
      }
      if (!persona.fechaUltimaAtencion || fechaAtencion > persona.fechaUltimaAtencion) {
        persona.fechaUltimaAtencion = fechaAtencion;
      }
    }

    if (row.asignacionCupId && !persona.cupsVistos.has(String(row.asignacionCupId))) {
      persona.cupsVistos.add(String(row.asignacionCupId));
      const codigo = String(row.cupsCodigo || "").trim();
      const nombre = String(row.cupsNombre || row.actividadNombre || "").trim();
      persona.cups.push({
        texto: normalizar(`${codigo} ${nombre}`),
        rol: normalizar(row.rol),
        etiqueta: [codigo, nombre].filter(Boolean).join(" - ") || "CUPS sin descripción",
      });
    }
  });

  return Array.from(personas.values()).map((persona) => {
    const edadMeses = edadEnMeses(persona.fechaNac, persona.fechaUltimaAtencion);
    const gestantePorCups = persona.cups.some(cupCumple.prenatal);
    return {
      ...persona,
      edadMeses,
      gestante: persona.sexo !== "M" && (persona.gestanteDeclarada || gestantePorCups),
    };
  });
}

function etiquetaEdad(edadMeses) {
  if (edadMeses === null) return "Sin fecha de nacimiento";
  if (edadMeses < 24) return `${edadMeses} meses`;
  return `${Math.floor(edadMeses / 12)} años`;
}

export async function getIndicadoresSalud(query = {}, actor = null) {
  ensure(actor, "Usuario autenticado requerido", 401);
  const cargo = String(actor?.cargo || "").trim().toLowerCase();
  ensure(
    ["admin", "administrador", "superusuario"].includes(cargo),
    "Solo administradores pueden consultar indicadores",
    403
  );

  const fechaInicio = String(query.fechaInicio || "").trim();
  const fechaFin = String(query.fechaFin || "").trim();
  ensure(DATE_ONLY_RE.test(fechaInicio), "Debe enviar fechaInicio en formato YYYY-MM-DD", 400);
  ensure(DATE_ONLY_RE.test(fechaFin), "Debe enviar fechaFin en formato YYYY-MM-DD", 400);
  ensure(fechaInicio <= fechaFin, "La fecha de inicio no puede ser mayor que la fecha fin", 400);

  const rows = await listIndicadoresSaludBase({
    fechaInicio,
    fechaFin,
    convenio: query.convenio,
    ipsId: cargo === "superusuario" ? null : actor?.ipsId,
  });

  const personas = construirPersonas(rows);
  const detalle = [];

  const indicadores = INDICADORES.map((indicador) => {
    let denominador = 0;
    let numerador = 0;
    let numeradorCups = 0;
    let numeradorCaracterizacion = 0;

    personas.forEach((persona) => {
      if (!indicador.denominador(persona)) return;
      denominador += 1;
      const resultado = indicador.numerador(persona);
      if (resultado.cumple) {
        numerador += 1;
        if (resultado.fuente === FUENTE_CARACTERIZACION) numeradorCaracterizacion += 1;
        else numeradorCups += 1;
      }

      detalle.push({
        codigo: indicador.codigo,
        indicador: indicador.nombre,
        paciente: persona.paciente,
        documento: persona.documento,
        sexo: persona.sexo || "Sin dato",
        edad: etiquetaEdad(persona.edadMeses),
        convenio: persona.convenio,
        eps: persona.eps,
        fechaAtencion: formatearFecha(persona.fechaUltimaAtencion),
        cumple: resultado.cumple ? "Sí" : "No",
        fuente: resultado.cumple ? resultado.fuente || FUENTE_CUPS : "",
        esquemaVacunal: persona.esquemaVacunalTexto || "Sin caracterización",
        evidencia: (resultado.evidencia || []).join(" | "),
      });
    });

    return {
      codigo: indicador.codigo,
      nombre: indicador.nombre,
      poblacion: indicador.poblacion,
      criterio: indicador.criterio,
      numerador,
      numeradorCups,
      numeradorCaracterizacion,
      denominador,
      porcentaje: denominador ? Math.round((numerador / denominador) * 10000) / 100 : 0,
    };
  });

  return {
    periodo: { fechaInicio, fechaFin, convenio: String(query.convenio || "").trim() },
    totalPacientes: personas.length,
    totalEncuestas: new Set(rows.map((row) => String(row.encuestaId))).size,
    totalCaracterizados: personas.filter((persona) => persona.esquemaVacunal).length,
    indicadores,
    detalle,
  };
}
