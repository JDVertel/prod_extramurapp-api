import {
  getDisponiblesFacturacionPorDocumento,
  getDisponiblesFacturacionPorRango,
  getHistorialFacturacion,
  getInformeCerradosFacturacion,
  getPendientesFacturacion,
} from "../services/facturacion.service.js";

export async function getPendientesFacturacionController(req, res) {
  res.json(await getPendientesFacturacion(req.query || {}, req.user));
}

export async function getHistorialFacturacionController(req, res) {
  res.json(await getHistorialFacturacion(req.query || {}, req.user));
}

export async function getDisponiblesFacturacionPorRangoController(req, res) {
  res.json(await getDisponiblesFacturacionPorRango(req.query || {}, req.user));
}

export async function getDisponiblesFacturacionPorDocumentoController(req, res) {
  res.json(await getDisponiblesFacturacionPorDocumento(req.query || {}, req.user));
}

export async function getInformeCerradosFacturacionController(req, res) {
  res.json(await getInformeCerradosFacturacion(req.query || {}, req.user));
}
