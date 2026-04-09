import { pool } from "../utils/database.js";

async function main() {
  const [rows] = await pool.query(
    "SELECT id,email,cargo,activo,must_change_password,ips_id,updated_at FROM users WHERE cargo = ? OR email LIKE ? ORDER BY updated_at DESC",
    ["superusuario", "%super%"]
  );

  console.table(rows);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
