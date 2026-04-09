import { hashPassword } from "../utils/auth.js";
import { pool } from "../utils/database.js";

const EMAIL = "super@sistema.com";
const NEW_PASSWORD = "Super2026!";

async function main() {
  const passwordHash = await hashPassword(NEW_PASSWORD);

  const [result] = await pool.query(
    `UPDATE users
     SET password_hash = ?, must_change_password = 0, activo = 1
     WHERE email = ? AND cargo = 'superusuario'`,
    [passwordHash, EMAIL]
  );

  if (!result.affectedRows) {
    throw new Error("No se encontro el superusuario esperado para reset de clave");
  }

  console.log(`Password restablecida para ${EMAIL}`);
  console.log(`Nueva clave temporal: ${NEW_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
