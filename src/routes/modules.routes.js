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

// Rutas públicas: lectura de IPS (necesaria antes del login en App.vue)
router.get("/ips", (req, _res, next) => {
  req.params.moduleName = "ips";
  next();
}, asyncHandler(listModuleController));

router.get("/ips/:id", (req, _res, next) => {
  req.params.moduleName = "ips";
  next();
}, asyncHandler(getModuleByIdController));

// Todas las demás rutas requieren autenticación
router.use(requireAuth);

// Módulos normales (accesibles para cualquier usuario autenticado)
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

// Módulo IPS: lectura libre, escritura solo superusuario
const IPS_MODULE = "ips";

MODULE_NAMES.forEach((moduleName) => {
  router.get(`/${moduleName}`, (req, _res, next) => {
    req.params.moduleName = moduleName;
    next();
  }, asyncHandler(listModuleController));

  router.get(`/${moduleName}/:id`, (req, _res, next) => {
    req.params.moduleName = moduleName;
    next();
  }, asyncHandler(getModuleByIdController));

  router.post(`/${moduleName}`, (req, _res, next) => {
    req.params.moduleName = moduleName;
    next();
  }, asyncHandler(createModuleController));

  router.put(`/${moduleName}/:id`, (req, _res, next) => {
    req.params.moduleName = moduleName;
    next();
  }, asyncHandler(replaceModuleController));

  router.patch(`/${moduleName}/:id`, (req, _res, next) => {
    req.params.moduleName = moduleName;
    next();
  }, asyncHandler(patchModuleController));

  router.delete(`/${moduleName}/:id`, (req, _res, next) => {
    req.params.moduleName = moduleName;
    next();
  }, asyncHandler(deleteModuleController));
});

// IPS: mutaciones solo superusuario (GET ya definido como público arriba)
router.post(`/${IPS_MODULE}`, requireSuperUser, (req, _res, next) => {
  req.params.moduleName = IPS_MODULE;
  next();
}, asyncHandler(createModuleController));

router.put(`/${IPS_MODULE}/:id`, requireSuperUser, (req, _res, next) => {
  req.params.moduleName = IPS_MODULE;
  next();
}, asyncHandler(replaceModuleController));

router.patch(`/${IPS_MODULE}/:id`, requireSuperUser, (req, _res, next) => {
  req.params.moduleName = IPS_MODULE;
  next();
}, asyncHandler(patchModuleController));

router.delete(`/${IPS_MODULE}/:id`, requireSuperUser, (req, _res, next) => {
  req.params.moduleName = IPS_MODULE;
  next();
}, asyncHandler(deleteModuleController));

router.get("/caracterizacion/by-encuesta/:encuestaId", asyncHandler(getCaracterizacionByEncuestaController));

export default router;
