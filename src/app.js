import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { errorHandler } from "./middleware/error-handler.js";
import apiRoutes from "./routes/index.js";
import { config } from "./utils/config.js";

export function createApp() {
  const app = express();
  const isProduction = config.nodeEnv === "production";

  // Necesario detrás de Caddy/Nginx para X-Forwarded-For / X-Forwarded-Proto
  app.set("trust proxy", true);
  app.disable("x-powered-by");

  app.use(
    helmet({
      // En proxy HTTPS (Caddy) evita forzar HSTS agresivo desde la API
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );

  app.use(compression());

  const allowedOrigins = new Set(config.corsOrigins);
  app.use(
    cors({
      origin(origin, callback) {
        // Requests same-origin / tools sin Origin (curl, healthchecks)
        if (!origin) {
          callback(null, true);
          return;
        }

        if (allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }

        // No lanzar Error: eso provoca 500 en el error handler.
        // Simplemente denegar el origen (el navegador bloqueará CORS).
        console.warn(`[CORS] Origen no permitido: ${origin}`);
        callback(null, false);
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );

  app.use(express.json({ limit: "5mb" }));
  app.use(
    morgan(isProduction ? "tiny" : "dev", {
      skip(req) {
        return isProduction && (req.path === "/api/health" || req.path === "/health");
      },
    })
  );

  app.use("/api", apiRoutes);
  app.use(errorHandler);

  return app;
}
