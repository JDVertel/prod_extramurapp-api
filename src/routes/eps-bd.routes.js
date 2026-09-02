import { Router } from "express";
import {
  bulkImportEpsBdRegistrosController,
  createEpsBdController,
  deleteEpsBdController,
  exportEpsBdRegistrosController,
  listEpsBdController,
  listEpsBdIndiceDocumentosController,
  listEpsBdRegistrosController,
  updateEpsBdController,
} from "../controllers/eps-bd.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();

router.use(asyncHandler(requireAuth));

router.get("/", asyncHandler(listEpsBdController));
router.get("/indice-documentos", asyncHandler(listEpsBdIndiceDocumentosController));
router.post("/", asyncHandler(createEpsBdController));
router.patch("/:id", asyncHandler(updateEpsBdController));
router.delete("/:id", asyncHandler(deleteEpsBdController));

router.get("/:id/registros", asyncHandler(listEpsBdRegistrosController));
router.get("/:id/registros/export", asyncHandler(exportEpsBdRegistrosController));
router.post("/:id/registros/bulk", asyncHandler(bulkImportEpsBdRegistrosController));

export default router;
