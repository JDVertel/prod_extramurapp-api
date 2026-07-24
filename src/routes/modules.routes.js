import { Router } from "express";
import {
  createModuleController,
  deleteModuleController,
  getCaracterizacionByEncuestaController,
  getModuleByIdController,
  listModuleController,
  patchModuleController,
  replaceModuleController,
} from "../controllers/modules.controller.js";
import { requireAuth, requireSuperUser } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();

// ------------------------------------------------------------
// Rutas públicas (sin JWT): lectura de IPS antes del login
// ------------------------------------------------------------
router.get("/ips", (req, _res, next) => {
  req.params.moduleName = "ips";
  next();
}, asyncHandler(listModuleController));

router.get("/ips/:id", (req, _res, next) => {
  req.params.moduleName = "ips";
  next();
}, asyncHandler(getModuleByIdController));

// ------------------------------------------------------------
// Rutas protegidas: el JWT se aplica por ruta, no como catch-all
// ------------------------------------------------------------
const MODULE_NAMES = [
  "encuestas",
  "encuesta_actividades",
  "asignaciones",
  "agendas",
  "caracterizacion",
  "comunas_barrios",
  "eps",
  "cups",
  "actividades_extra",
];

const IPS_MODULE = "ips";
const auth = asyncHandler(requireAuth);

MODULE_NAMES.forEach((moduleName) => {
  router.get(`/${moduleName}`, auth, (req, _res, next) => {
    req.params.moduleName = moduleName;
    next();
  }, asyncHandler(listModuleController));

  router.get(`/${moduleName}/:id`, auth, (req, _res, next) => {
    req.params.moduleName = moduleName;
    next();
  }, asyncHandler(getModuleByIdController));

  router.post(`/${moduleName}`, auth, (req, _res, next) => {
    req.params.moduleName = moduleName;
    next();
  }, asyncHandler(createModuleController));

  router.put(`/${moduleName}/:id`, auth, (req, _res, next) => {
    req.params.moduleName = moduleName;
    next();
  }, asyncHandler(replaceModuleController));

  router.patch(`/${moduleName}/:id`, auth, (req, _res, next) => {
    req.params.moduleName = moduleName;
    next();
  }, asyncHandler(patchModuleController));

  router.delete(`/${moduleName}/:id`, auth, (req, _res, next) => {
    req.params.moduleName = moduleName;
    next();
  }, asyncHandler(deleteModuleController));
});

// IPS: mutaciones solo superusuario (GET ya definido como público arriba)
router.post(`/${IPS_MODULE}`, auth, requireSuperUser, (req, _res, next) => {
  req.params.moduleName = IPS_MODULE;
  next();
}, asyncHandler(createModuleController));

router.put(`/${IPS_MODULE}/:id`, auth, requireSuperUser, (req, _res, next) => {
  req.params.moduleName = IPS_MODULE;
  next();
}, asyncHandler(replaceModuleController));

router.patch(`/${IPS_MODULE}/:id`, auth, requireSuperUser, (req, _res, next) => {
  req.params.moduleName = IPS_MODULE;
  next();
}, asyncHandler(patchModuleController));

router.delete(`/${IPS_MODULE}/:id`, auth, requireSuperUser, (req, _res, next) => {
  req.params.moduleName = IPS_MODULE;
  next();
}, asyncHandler(deleteModuleController));

router.get(
  "/caracterizacion/by-encuesta/:encuestaId",
  auth,
  asyncHandler(getCaracterizacionByEncuestaController)
);

export default router;
