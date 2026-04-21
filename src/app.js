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

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS no permitido para origen: ${origin}`));
    },
  }));
  app.use(express.json({ limit: "5mb" }));
  app.use(
    morgan(isProduction ? "tiny" : "dev", {
      skip(req) {
        return isProduction && req.path === "/api/health";
      },
    })
  );

  app.use("/api", apiRoutes);
  app.use(errorHandler);

  return app;
}