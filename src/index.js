import { createApp } from "./app.js";
import { testDbConnection } from "./utils/database.js";
import { config, logStartupConfig } from "./utils/config.js";

const app = createApp();

async function bootstrap() {
  logStartupConfig();
  await testDbConnection();

  const server = app.listen(config.port, () => {
    console.log(`API lista en http://localhost:${config.port}`);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(
        `Puerto ${config.port} ya esta en uso. Cierra la otra instancia de la API o cambia PORT en .env`
      );
    } else {
      console.error("No se pudo iniciar la API:", error.message);
    }
    process.exit(1);
  });
}

bootstrap().catch((error) => {
  console.error("No se pudo iniciar la API:", error.message);
  process.exit(1);
});
