export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function normalizeDocument(numDocumento) {
  return String(numDocumento || "").trim();
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
    activo: row.activo === undefined ? undefined : Boolean(row.activo),
    bandejas,
    accesosProfesionales,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
      bandejas,
      accesosProfesionales,
      mustChangePassword: Boolean(row.must_change_password),
    },
  };
}