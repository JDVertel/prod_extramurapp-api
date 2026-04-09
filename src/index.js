import { createApp } from "./app.js";
import { testDbConnection } from "./utils/database.js";
import { config } from "./utils/config.js";

const app = createApp();

async function bootstrap() {
  await testDbConnection();
  app.listen(config.port, () => {
    console.log(`API lista en http://localhost:${config.port}`);
  });
}

bootstrap().catch((error) => {
  console.error("No se pudo iniciar la API:", error.message);
  process.exit(1);
});
