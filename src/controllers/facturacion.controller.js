import {
  getDisponiblesFacturacionPorDocumento,
  getDisponiblesFacturacionPorRango,
  getPendientesFacturacion,
} from "../services/facturacion.service.js";

export async function getPendientesFacturacionController(req, res) {
  res.json(await getPendientesFacturacion(req.query || {}, req.user));
}

export async function getDisponiblesFacturacionPorRangoController(req, res) {
  res.json(await getDisponiblesFacturacionPorRango(req.query || {}, req.user));
}

export async function getDisponiblesFacturacionPorDocumentoController(req, res) {
  res.json(await getDisponiblesFacturacionPorDocumento(req.query || {}, req.user));
}
