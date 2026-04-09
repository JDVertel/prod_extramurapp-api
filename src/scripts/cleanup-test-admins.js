import { pool } from "../utils/database.js";

async function main() {
  const [result] = await pool.query(
    "DELETE FROM users WHERE email LIKE ? OR email LIKE ?",
    ["admin.test.ips2.%@mail.com", "admin.test.ips2.fix.%@mail.com"]
  );

  console.log(`deleted=${result.affectedRows}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
