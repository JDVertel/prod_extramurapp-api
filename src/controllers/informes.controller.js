import { getFacturacionProfesionalCerrada } from "../services/informes.service.js";

export async function getFacturacionProfesionalCerradaController(req, res) {
  res.json(await getFacturacionProfesionalCerrada(req.query || {}, req.user));
}
