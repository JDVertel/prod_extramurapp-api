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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    mustChangePassword:
      row.must_change_password === undefined ? undefined : Boolean(row.must_change_password),
  };
}

export function toAuthLoginResponse(row, token) {
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
      mustChangePassword: Boolean(row.must_change_password),
    },
  };
}