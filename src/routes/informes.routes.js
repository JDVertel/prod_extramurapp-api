import { Router } from "express";
import {
  getAsignacionesCupsBulkController,
  getFacturacionProfesionalCerradaController,
} from "../controllers/informes.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();

router.use(asyncHandler(requireAuth));

router.get(
  "/profesionales-facturacion",
  asyncHandler(getFacturacionProfesionalCerradaController)
);

router.post(
  "/asignaciones-cups",
  asyncHandler(getAsignacionesCupsBulkController)
);

export default router;
