import {
  getAsignacionesCupsBulk,
  getFacturacionProfesionalCerrada,
} from "../services/informes.service.js";

export async function getFacturacionProfesionalCerradaController(req, res) {
  res.json(await getFacturacionProfesionalCerrada(req.query || {}, req.user));
}

export async function getAsignacionesCupsBulkController(req, res) {
  res.json(await getAsignacionesCupsBulk(req.body || {}, req.user));
}
