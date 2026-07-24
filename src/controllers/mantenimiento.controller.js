import {
  applyEliminarEncuestasHuerfanas,
  applyLimpiezaDocumentosPacientes,
  previewEncuestasHuerfanasSinCaracterizacion,
  previewLimpiezaDocumentosPacientes,
} from "../services/mantenimiento.service.js";

export async function previewLimpiezaDocumentosController(req, res) {
  res.json(await previewLimpiezaDocumentosPacientes(req.user));
}

export async function applyLimpiezaDocumentosController(req, res) {
  res.json(await applyLimpiezaDocumentosPacientes(req.body || {}, req.user));
}

export async function previewEncuestasHuerfanasController(req, res) {
  const meses = Number(req.query?.meses || 1);
  res.json(await previewEncuestasHuerfanasSinCaracterizacion(req.user, { meses }));
}

export async function applyEliminarEncuestasHuerfanasController(req, res) {
  res.json(await applyEliminarEncuestasHuerfanas(req.body || {}, req.user));
}
