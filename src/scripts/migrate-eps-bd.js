import { ensureEpsBdTables } from "../repositories/eps-bd.repository.js";
import { pool } from "../utils/database.js";

async function main() {
  await ensureEpsBdTables();
  console.log("[migrate:eps-bd] Tablas eps_bd y eps_bd_registros verificadas.");
  await pool.end();
}

main().catch((error) => {
  console.error("[migrate:eps-bd] Error:", error);
  process.exit(1);
});
