import { Router } from "express";
import { getFacturacionProfesionalCerradaController } from "../controllers/informes.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();

router.use(requireAuth);

router.get(
  "/profesionales-facturacion",
  asyncHandler(getFacturacionProfesionalCerradaController)
);

export default router;
