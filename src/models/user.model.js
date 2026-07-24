export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function normalizeDocument(numDocumento) {
  return String(numDocumento || "").trim();
}

function formatDateOnly(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, "0");
    const dd = String(value.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return text.slice(0, 10);
  }

  const match = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (match) {
    return `${match[3]}-${String(match[2]).padStart(2, "0")}-${String(match[1]).padStart(2, "0")}`;
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    const yyyy = parsed.getFullYear();
    const mm = String(parsed.getMonth() + 1).padStart(2, "0");
    const dd = String(parsed.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  return null;
}

export function toUserResponse(row) {
  if (!row) {
    return null;
  }

  let bandejas = [];
  if (Array.isArray(row.bandejas)) {
    bandejas = row.bandejas;
  } else if (typeof row.bandejas === "string" && row.bandejas.trim()) {
    try {
      const parsed = JSON.parse(row.bandejas);
      if (Array.isArray(parsed)) {
        bandejas = parsed;
      }
    } catch (_) {
      bandejas = [];
    }
  }

  let accesosProfesionales = [];
  if (Array.isArray(row.accesos_profesionales)) {
    accesosProfesionales = row.accesos_profesionales;
  } else if (typeof row.accesos_profesionales === "string" && row.accesos_profesionales.trim()) {
    try {
      const parsed = JSON.parse(row.accesos_profesionales);
      if (Array.isArray(parsed)) {
        accesosProfesionales = parsed;
      }
    } catch (_) {
      accesosProfesionales = [];
    }
  }

  return {
    id: row.id,
    email: row.email,
    nombre: row.nombre,
    cargo: row.cargo,
    ipsId: row.ips_id,
    convenio: row.convenio,
    grupo: row.grupo,
    numDocumento: row.num_documento,
    telefono: row.telefono ?? null,
    fechaFinContrato: formatDateOnly(row.fecha_fin_contrato),
    activo: row.activo === undefined ? undefined : Boolean(row.activo),
    bandejas,
    accesosProfesionales,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    failedLoginAttempts: row.failed_login_attempts === undefined ? 0 : Number(row.failed_login_attempts || 0),
    lockLevel: row.lock_level === undefined ? 0 : Number(row.lock_level || 0),
    lockedUntil: row.locked_until ?? null,
    isLocked: row.is_locked === undefined ? false : Boolean(row.is_locked),
    mustChangePassword:
      row.must_change_password === undefined ? undefined : Boolean(row.must_change_password),
  };
}

export function toAuthLoginResponse(row, token) {
  let bandejas = [];
  if (Array.isArray(row.bandejas)) {
    bandejas = row.bandejas;
  } else if (typeof row.bandejas === "string" && row.bandejas.trim()) {
    try {
      const parsed = JSON.parse(row.bandejas);
      if (Array.isArray(parsed)) {
        bandejas = parsed;
      }
    } catch (_) {
      bandejas = [];
    }
  }

  let accesosProfesionales = [];
  if (Array.isArray(row.accesos_profesionales)) {
    accesosProfesionales = row.accesos_profesionales;
  } else if (typeof row.accesos_profesionales === "string" && row.accesos_profesionales.trim()) {
    try {
      const parsed = JSON.parse(row.accesos_profesionales);
      if (Array.isArray(parsed)) {
        accesosProfesionales = parsed;
      }
    } catch (_) {
      accesosProfesionales = [];
    }
  }

  return {
    token,
    uid: row.id,
    user: {
      id: row.id,
      email: row.email,
      nombre: row.nombre,
      cargo: row.cargo,
      ipsId: row.ips_id,
      convenio: row.convenio,
      grupo: row.grupo,
      numDocumento: row.num_documento,
      telefono: row.telefono ?? null,
      fechaFinContrato: formatDateOnly(row.fecha_fin_contrato),
      bandejas,
      accesosProfesionales,
      mustChangePassword: Boolean(row.must_change_password),
    },
  };
}