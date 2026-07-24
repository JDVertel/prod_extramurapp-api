import { pool } from "../utils/database.js";

async function run() {
  const [result] = await pool.query(
    `UPDATE users
     SET grupo = 'F'
     WHERE LOWER(TRIM(cargo)) IN ('fact', 'facturador')
       AND (
         grupo IS NULL
         OR TRIM(grupo) = ''
         OR LOWER(TRIM(grupo)) = 'todos'
       )`
  );

  console.log(`Facturadores actualizados a grupo 'F': ${result?.affectedRows ?? 0}`);

  const [accesosResult] = await pool.query(
    `UPDATE users
     SET accesos_profesionales = JSON_ARRAY()
     WHERE LOWER(TRIM(cargo)) IN ('fact', 'facturador')
       AND accesos_profesionales IS NOT NULL
       AND JSON_LENGTH(accesos_profesionales) > 0`
  );

  console.log(`Accesos delegados eliminados en facturadores: ${accesosResult?.affectedRows ?? 0}`);
}

run()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("Error en migracion de grupos de facturadores:", error);
    await pool.end();
    process.exit(1);
  });
