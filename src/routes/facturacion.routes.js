import { Router } from "express";
import {
  getDisponiblesFacturacionPorDocumentoController,
  getDisponiblesFacturacionPorRangoController,
  getPendientesFacturacionController,
} from "../controllers/facturacion.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();

router.use(asyncHandler(requireAuth));

router.get("/pendientes", asyncHandler(getPendientesFacturacionController));
router.get("/disponibles", asyncHandler(getDisponiblesFacturacionPorRangoController));
router.get("/disponibles-por-documento", asyncHandler(getDisponiblesFacturacionPorDocumentoController));

export default router;
