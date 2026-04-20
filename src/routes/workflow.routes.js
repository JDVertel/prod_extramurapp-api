import { Router } from "express";
import {
  returnEncuestaToAuxiliarController,
  saveCaracterizacionWorkflowController,
} from "../controllers/workflow.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();

router.use(requireAuth);

router.post("/caracterizacion/guardar", asyncHandler(saveCaracterizacionWorkflowController));
router.post("/encuestas/:encuestaId/devolver-auxiliar", asyncHandler(returnEncuestaToAuxiliarController));

export default router;