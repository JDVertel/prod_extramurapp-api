export class AppError extends Error {
  constructor(message, statusCode = 500, detail = null) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.detail = detail;
  }
}

export function ensure(condition, message, statusCode = 400, detail = null) {
  if (!condition) {
    throw new AppError(message, statusCode, detail);
  }
}