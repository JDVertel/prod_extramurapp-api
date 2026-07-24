import dotenv from "dotenv";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");

function loadEnvFile(filename) {
  const filePath = path.join(rootDir, filename);
  if (fs.existsSync(filePath)) {
    dotenv.config({ path: filePath });
  }
}

// Variables ya definidas en el sistema (PM2, Docker, etc.) no se sobrescriben.
loadEnvFile(".env");
loadEnvFile(".env.local");

function normalizeOrigins(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:4173",
      "http://127.0.0.1:4173",
    ];
  }

  return raw
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

export const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 3000),
  corsOrigins: normalizeOrigins(process.env.CORS_ORIGIN),
  mysql: {
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "extramurapp",
  },
  jwtSecret: process.env.JWT_SECRET || "change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "12h",
  showResetTokenInResponse:
    String(process.env.SHOW_RESET_TOKEN_IN_RESPONSE || "false").toLowerCase() === "true",
};

export const isProduction = config.nodeEnv === "production";

export function logStartupConfig() {
  const { mysql } = config;
  console.log(
    `[${config.nodeEnv}] MySQL ${mysql.user}@${mysql.host}:${mysql.port}/${mysql.database}`
  );
  console.log(`[${config.nodeEnv}] CORS origins: ${config.corsOrigins.join(" | ") || "(ninguno)"}`);
  console.log(`[${config.nodeEnv}] trust proxy: habilitado`);

  if (isProduction && (config.jwtSecret === "change-me" || /dev/i.test(config.jwtSecret))) {
    console.warn("ADVERTENCIA: JWT_SECRET inseguro en producción. Actualiza el .env del servidor.");
  }
}