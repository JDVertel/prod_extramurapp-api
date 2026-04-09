import {
  createModule,
  getCaracterizacionByEncuestaId,
  getModuleById,
  listModule,
  patchModule,
  removeModule,
  replaceModule,
} from "../services/module.service.js";

export async function listModuleController(req, res) {
  res.json(await listModule(req.params.moduleName, req.query || {}, req.user));
}

export async function getModuleByIdController(req, res) {
  res.json(await getModuleById(req.params.moduleName, req.params.id, req.user));
}

export async function createModuleController(req, res) {
  try {
    res.status(201).json(await createModule(req.params.moduleName, req.body || {}, req.user));
  } catch (error) {
    if (req.params.moduleName === "contratos") {
      console.error("Error creando contrato", {
        message: error?.message,
        code: error?.code,
        sqlMessage: error?.sqlMessage,
        payloadResumen: {
          epsId: req.body?.epsId ?? req.body?.eps_id,
          epsNombre: req.body?.epsNombre ?? req.body?.eps_nombre,
          cupsCount: Array.isArray(req.body?.cups) ? req.body.cups.length : 0,
        },
      });
    }
    throw error;
  }
}

export async function replaceModuleController(req, res) {
  res.json(await replaceModule(req.params.moduleName, req.params.id, req.body || {}, req.user));
}

export async function patchModuleController(req, res) {
  res.json(await patchModule(req.params.moduleName, req.params.id, req.body || {}, req.user));
}

export async function deleteModuleController(req, res) {
  res.json(await removeModule(req.params.moduleName, req.params.id, req.user));
}

export async function getCaracterizacionByEncuestaController(req, res) {
  res.json(await getCaracterizacionByEncuestaId(req.params.encuestaId, req.user));
}