import { AppError, ensure } from "../utils/app-error.js";
import { pool } from "../utils/database.js";

function normalizeCargo(cargo) {
  return String(cargo || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function assertAdminMaintenanceAccess(actor) {
  const cargo = normalizeCargo(actor?.cargo);
  ensure(
    cargo === "admin" || cargo === "administrador" || cargo === "superusuario",
    "Acceso restringido a administradores",
    403
  );
}

export function sanitizarDocumentoAlfanumerico(valor) {
  return String(valor ?? "").replace(/[^A-Za-z0-9]/g, "");
}

function buildNombrePaciente(row = {}) {
  return [row.nombre1, row.nombre2, row.apellido1, row.apellido2]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .join(" ");
}

function resolveScopedIpsId(actor) {
  const cargo = normalizeCargo(actor?.cargo);
  if (cargo === "superusuario") {
    return null;
  }
  return String(actor?.ipsId || actor?.ips_id || "").trim() || null;
}

/**
 * Analiza documentos de pacientes que cambiarían al limpiar caracteres especiales.
 * No modifica la BD.
 */
export async function previewLimpiezaDocumentosPacientes(actor = null) {
  assertAdminMaintenanceAccess(actor);

  const ipsId = resolveScopedIpsId(actor);
  if (normalizeCargo(actor?.cargo) !== "superusuario") {
    ensure(ipsId, "No se detectó IPS en la sesión del administrador", 400);
  }

  const params = [];
  let whereIps = "";
  if (ipsId) {
    whereIps = "WHERE (ips_id = ? OR ips_id IS NULL OR ips_id = '')";
    params.push(ipsId);
  }

  const [rows] = await pool.query(
    `SELECT id, tipodoc, numdoc, convenio, ips_id, nombre1, nombre2, apellido1, apellido2, fecha
       FROM encuestas
       ${whereIps}
       ORDER BY updated_at DESC`,
    params
  );

  const cambios = [];
  const destinoCount = new Map();
  const existentesLimpios = new Map();

  for (const row of rows || []) {
    const tipodoc = String(row.tipodoc || "").trim();
    const convenio = String(row.convenio || "").trim();
    const actual = String(row.numdoc ?? "").trim();
    if (!actual) continue;

    const limpioKey = `${tipodoc}||${actual}||${convenio}`.toLowerCase();
    if (!existentesLimpios.has(limpioKey)) {
      existentesLimpios.set(limpioKey, row.id);
    }

    const limpio = sanitizarDocumentoAlfanumerico(actual);
    if (!limpio || limpio === actual) continue;

    const key = `${tipodoc}||${limpio}||${convenio}`.toLowerCase();
    destinoCount.set(key, (destinoCount.get(key) || 0) + 1);

    cambios.push({
      id: row.id,
      tipodoc,
      convenio,
      ipsId: row.ips_id || null,
      numdocActual: actual,
      numdocNuevo: limpio,
      nombre: buildNombrePaciente(row) || "—",
      fecha: row.fecha || null,
      seleccionado: true,
      colision: false,
      motivoColision: null,
    });
  }

  for (const cambio of cambios) {
    const key = `${cambio.tipodoc}||${cambio.numdocNuevo}||${cambio.convenio}`.toLowerCase();
    const entreCandidatos = (destinoCount.get(key) || 0) > 1;
    const existenteId = existentesLimpios.get(key);

    if (existenteId && existenteId !== cambio.id) {
      cambio.colision = true;
      cambio.seleccionado = false;
      cambio.motivoColision = `Ya existe otro registro con documento ${cambio.numdocNuevo} (mismo tipo y convenio)`;
    } else if (entreCandidatos) {
      cambio.colision = true;
      cambio.seleccionado = false;
      cambio.motivoColision = "Varios registros candidatos terminarían con el mismo documento";
    }
  }

  return {
    totalAnalizados: (rows || []).length,
    totalAfectados: cambios.length,
    totalConColision: cambios.filter((item) => item.colision).length,
    totalSeleccionables: cambios.filter((item) => !item.colision).length,
    cambios,
  };
}

/**
 * Aplica la limpieza solo a los IDs seleccionados.
 */
export async function applyLimpiezaDocumentosPacientes(payload = {}, actor = null) {
  assertAdminMaintenanceAccess(actor);

  const ids = Array.isArray(payload.ids)
    ? payload.ids.map((id) => String(id || "").trim()).filter(Boolean)
    : [];

  ensure(ids.length > 0, "Debe seleccionar al menos un registro para aplicar", 400);

  const preview = await previewLimpiezaDocumentosPacientes(actor);
  const porId = new Map(preview.cambios.map((item) => [item.id, item]));

  const aplicados = [];
  const omitidos = [];

  for (const id of ids) {
    const cambio = porId.get(id);
    if (!cambio) {
      omitidos.push({ id, motivo: "El registro ya no requiere cambio o no está en el alcance" });
      continue;
    }
    if (cambio.colision) {
      omitidos.push({ id, motivo: cambio.motivoColision || "Colisión detectada" });
      continue;
    }

    const [result] = await pool.query(
      `UPDATE encuestas
          SET numdoc = ?
        WHERE id = ?
          AND TRIM(COALESCE(numdoc, '')) = ?`,
      [cambio.numdocNuevo, id, cambio.numdocActual]
    );

    if (!result?.affectedRows) {
      omitidos.push({ id, motivo: "No se pudo actualizar (posible cambio concurrente)" });
      continue;
    }

    aplicados.push({
      id,
      numdocActual: cambio.numdocActual,
      numdocNuevo: cambio.numdocNuevo,
      tipodoc: cambio.tipodoc,
      convenio: cambio.convenio,
      nombre: cambio.nombre,
    });
  }

  return {
    totalSolicitados: ids.length,
    totalAplicados: aplicados.length,
    totalOmitidos: omitidos.length,
    aplicados,
    omitidos,
  };
}

function diasDesde(fechaReferencia) {
  if (!fechaReferencia) return null;
  const fecha = new Date(fechaReferencia);
  if (Number.isNaN(fecha.getTime())) return null;
  const diffMs = Date.now() - fecha.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Encuestas sin caracterización con antigüedad mayor a 1 mes.
 * No modifica la BD.
 */
export async function previewEncuestasHuerfanasSinCaracterizacion(actor = null, { meses = 1 } = {}) {
  assertAdminMaintenanceAccess(actor);

  const ipsId = resolveScopedIpsId(actor);
  if (normalizeCargo(actor?.cargo) !== "superusuario") {
    ensure(ipsId, "No se detectó IPS en la sesión del administrador", 400);
  }

  const mesesNum = Math.max(1, Number(meses) || 1);
  const params = [mesesNum];
  let whereIps = "";
  if (ipsId) {
    whereIps = "AND (e.ips_id = ? OR e.ips_id IS NULL OR e.ips_id = '')";
    params.push(ipsId);
  }

  const [rows] = await pool.query(
    `SELECT
        e.id,
        e.tipodoc,
        e.numdoc,
        e.convenio,
        e.ips_id,
        e.nombre1,
        e.nombre2,
        e.apellido1,
        e.apellido2,
        e.fecha,
        e.created_at,
        e.status_caracterizacion,
        e.status_visita,
        e.status_facturacion
      FROM encuestas e
      LEFT JOIN caracterizacion c ON c.encuesta_id = e.id
     WHERE c.id IS NULL
       AND COALESCE(e.fecha, DATE(e.created_at)) <= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
       ${whereIps}
     ORDER BY COALESCE(e.fecha, DATE(e.created_at)) ASC`,
    params
  );

  const huerfanos = (rows || []).map((row) => {
    const fechaRef = row.fecha || row.created_at;
    return {
      id: row.id,
      tipodoc: String(row.tipodoc || "").trim(),
      numdoc: String(row.numdoc || "").trim(),
      convenio: String(row.convenio || "").trim(),
      ipsId: row.ips_id || null,
      nombre: buildNombrePaciente(row) || "—",
      fecha: row.fecha || null,
      createdAt: row.created_at || null,
      diasAntiguedad: diasDesde(fechaRef),
      statusCaracterizacion: Number(row.status_caracterizacion || 0),
      statusVisita: Number(row.status_visita || 0),
      statusFacturacion: Number(row.status_facturacion || 0),
      seleccionado: false,
    };
  });

  return {
    criterioMeses: mesesNum,
    totalHuerfanos: huerfanos.length,
    huerfanos,
  };
}

/**
 * Elimina encuestas huérfanas seleccionadas (sin caracterización y > 1 mes).
 * Cascada BD elimina actividades/asignaciones asociadas.
 */
export async function applyEliminarEncuestasHuerfanas(payload = {}, actor = null) {
  assertAdminMaintenanceAccess(actor);

  const ids = Array.isArray(payload.ids)
    ? payload.ids.map((id) => String(id || "").trim()).filter(Boolean)
    : [];
  ensure(ids.length > 0, "Debe seleccionar al menos un registro huérfano", 400);

  const preview = await previewEncuestasHuerfanasSinCaracterizacion(actor, {
    meses: payload.meses ?? 1,
  });
  const porId = new Map(preview.huerfanos.map((item) => [item.id, item]));

  const eliminados = [];
  const omitidos = [];

  for (const id of ids) {
    const item = porId.get(id);
    if (!item) {
      omitidos.push({
        id,
        motivo: "Ya no cumple criterios de huérfano o quedó fuera de alcance",
      });
      continue;
    }

    const [result] = await pool.query(`DELETE FROM encuestas WHERE id = ?`, [id]);
    if (!result?.affectedRows) {
      omitidos.push({ id, motivo: "No se pudo eliminar (posible cambio concurrente)" });
      continue;
    }

    eliminados.push({
      id,
      numdoc: item.numdoc,
      tipodoc: item.tipodoc,
      convenio: item.convenio,
      nombre: item.nombre,
      fecha: item.fecha,
    });
  }

  return {
    totalSolicitados: ids.length,
    totalEliminados: eliminados.length,
    totalOmitidos: omitidos.length,
    eliminados,
    omitidos,
  };
}

