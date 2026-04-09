import { AppError } from "../utils/app-error.js";

export function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      message: err.message,
      detail: err.detail || undefined,
    });
  }

  console.error(err);
  return res.status(500).json({
    message: "Error interno del servidor",
    detail: err?.message,
  });
}