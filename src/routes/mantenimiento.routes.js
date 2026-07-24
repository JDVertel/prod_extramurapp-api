import { Router } from "express";
import {
  applyEliminarEncuestasHuerfanasController,
  applyLimpiezaDocumentosController,
  previewEncuestasHuerfanasController,
  previewLimpiezaDocumentosController,
} from "../controllers/mantenimiento.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();

router.use(requireAuth);

router.get(
  "/documentos-pacientes/preview",
  asyncHandler(previewLimpiezaDocumentosController)
);

router.post(
  "/documentos-pacientes/aplicar",
  asyncHandler(applyLimpiezaDocumentosController)
);

router.get(
  "/encuestas-huerfanas/preview",
  asyncHandler(previewEncuestasHuerfanasController)
);

router.post(
  "/encuestas-huerfanas/eliminar",
  asyncHandler(applyEliminarEncuestasHuerfanasController)
);

export default router;
