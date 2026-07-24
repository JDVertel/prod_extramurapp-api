import { AppError } from "../utils/app-error.js";

export function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      message: err.message,
      detail: err.detail || undefined,
    });
  }

  const sqlMapped = mapMysqlError(err);
  if (sqlMapped) {
    console.error("Error SQL controlado:", {
      code: err?.code,
      errno: err?.errno,
      sqlMessage: err?.sqlMessage,
      message: err?.message,
    });
    return res.status(sqlMapped.statusCode).json({
      message: sqlMapped.message,
      detail: sqlMapped.detail || undefined,
    });
  }

  console.error(err);
  return res.status(500).json({
    message: "Error interno del servidor",
    detail: err?.message,
  });
}

function mapMysqlError(err) {
  const code = String(err?.code || "");
  const sqlMessage = String(err?.sqlMessage || err?.message || "");

  if (code === "ER_DUP_ENTRY" || Number(err?.errno) === 1062) {
    if (/uq_contrato_cups/i.test(sqlMessage) || /contrato_cups/i.test(sqlMessage)) {
      return {
        statusCode: 409,
        message:
          "No se puede guardar el contrato: hay CUPS duplicados para la misma actividad. Quite los duplicados e intente de nuevo.",
        detail: sqlMessage,
      };
    }
    return {
      statusCode: 409,
      message: "No se puede guardar: el registro ya existe (duplicado).",
      detail: sqlMessage,
    };
  }

  if (code === "ER_NO_REFERENCED_ROW_2" || Number(err?.errno) === 1452) {
    if (/fk_contratos_eps|eps/i.test(sqlMessage)) {
      return {
        statusCode: 400,
        message:
          "No se puede guardar el contrato: la EPS indicada no existe o fue eliminada. Seleccione una EPS válida.",
        detail: sqlMessage,
      };
    }
    return {
      statusCode: 400,
      message:
        "No se puede guardar: hay una referencia inválida (EPS, contrato u otro dato relacionado no existe).",
      detail: sqlMessage,
    };
  }

  if (code === "ER_DATA_TOO_LONG" || Number(err?.errno) === 1406) {
    return {
      statusCode: 400,
      message:
        "No se puede guardar: uno de los campos supera la longitud permitida (por ejemplo nombre de CUPS, actividad o profesional).",
      detail: sqlMessage,
    };
  }

  if (code === "ER_BAD_NULL_ERROR" || Number(err?.errno) === 1048) {
    return {
      statusCode: 400,
      message:
        "No se puede guardar: falta un dato obligatorio. Verifique EPS, CUPS e información del contrato.",
      detail: sqlMessage,
    };
  }

  return null;
}