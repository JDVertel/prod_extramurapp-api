import {
  returnEncuestaToAuxiliar,
  saveCaracterizacionAndMarkEncuesta,
} from "../services/workflow.service.js";

export async function saveCaracterizacionWorkflowController(req, res) {
  res.status(201).json(await saveCaracterizacionAndMarkEncuesta(req.body || {}, req.user));
}

export async function returnEncuestaToAuxiliarController(req, res) {
  res.json(await returnEncuestaToAuxiliar(req.params.encuestaId, req.user));
}