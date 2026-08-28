import { Router } from "express";
import {
  getDisponiblesFacturacionPorDocumentoController,
  getDisponiblesFacturacionPorRangoController,
  getHistorialFacturacionController,
  getInformeCerradosFacturacionController,
  getPendientesFacturacionController,
} from "../controllers/facturacion.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();

router.use(asyncHandler(requireAuth));

router.get("/pendientes", asyncHandler(getPendientesFacturacionController));
router.get("/historial", asyncHandler(getHistorialFacturacionController));
router.get("/informe-cerrados", asyncHandler(getInformeCerradosFacturacionController));
router.get("/disponibles", asyncHandler(getDisponiblesFacturacionPorRangoController));
router.get("/disponibles-por-documento", asyncHandler(getDisponiblesFacturacionPorDocumentoController));

export default router;
