-- Ejecutar desde cliente mysql con el comando SOURCE.
-- Ejemplo:
--   mysql -u user -p < sql/tables/schema_by_table.sql

SOURCE sql/tables/00_init.sql;

SOURCE sql/tables/users.sql;
SOURCE sql/tables/password_reset_tokens.sql;
SOURCE sql/tables/rt_nodes.sql;

SOURCE sql/tables/comunas_barrios.sql;
SOURCE sql/tables/eps.sql;
SOURCE sql/tables/ips.sql;
SOURCE sql/tables/cups.sql;
SOURCE sql/tables/actividades_extra.sql;

SOURCE sql/tables/contratos.sql;
SOURCE sql/tables/contrato_cups.sql;

SOURCE sql/tables/encuestas.sql;
SOURCE sql/tables/encuesta_actividades.sql;
SOURCE sql/tables/asignaciones.sql;
SOURCE sql/tables/asignacion_cups.sql;
SOURCE sql/tables/agendas.sql;
SOURCE sql/tables/caracterizacion.sql;
