import {
  createContratoService,
  getContratoByIdService,
  listContratosService,
  removeContratoService,
  replaceContratoService,
} from "../services/contrato.service.js";

export async function listContratosController(req, res) {
  res.json(await listContratosService(req.query || {}, req.user));
}

export async function getContratoByIdController(req, res) {
  res.json(await getContratoByIdService(req.params.id, req.user));
}

export async function createContratoController(req, res) {
  res.status(201).json(await createContratoService(req.body || {}, req.user));
}

export async function replaceContratoController(req, res) {
  res.json(await replaceContratoService(req.params.id, req.body || {}, req.user));
}

export async function deleteContratoController(req, res) {
  res.json(await removeContratoService(req.params.id, req.user));
}
