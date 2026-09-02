import {
  bulkImportEpsBdRegistros,
  createEpsBdEntry,
  getEpsBdIndiceDocumentos,
  getEpsBdList,
  getEpsBdRegistros,
  getEpsBdRegistrosExport,
  removeEpsBdEntry,
  updateEpsBdEntry,
} from "../services/eps-bd.service.js";

export async function listEpsBdController(_req, res) {
  res.json(await getEpsBdList());
}

export async function createEpsBdController(req, res) {
  res.status(201).json(await createEpsBdEntry(req.body || {}));
}

export async function updateEpsBdController(req, res) {
  res.json(await updateEpsBdEntry(req.params.id, req.body || {}));
}

export async function deleteEpsBdController(req, res) {
  res.json(await removeEpsBdEntry(req.params.id));
}

export async function listEpsBdIndiceDocumentosController(_req, res) {
  res.json(await getEpsBdIndiceDocumentos());
}

export async function listEpsBdRegistrosController(req, res) {
  res.json(await getEpsBdRegistros(req.params.id, req.query || {}));
}

export async function exportEpsBdRegistrosController(req, res) {
  res.json(await getEpsBdRegistrosExport(req.params.id));
}

export async function bulkImportEpsBdRegistrosController(req, res) {
  res.json(await bulkImportEpsBdRegistros(req.params.id, req.body || {}));
}
