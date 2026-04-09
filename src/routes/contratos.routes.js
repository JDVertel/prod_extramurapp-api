import { Router } from "express";
import {
  createContratoController,
  deleteContratoController,
  getContratoByIdController,
  listContratosController,
  replaceContratoController,
} from "../controllers/contratos.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();

router.use(requireAuth);

router.get("", asyncHandler(listContratosController));
router.get("/:id", asyncHandler(getContratoByIdController));
router.post("", asyncHandler(createContratoController));
router.put("/:id", asyncHandler(replaceContratoController));
router.delete("/:id", asyncHandler(deleteContratoController));

export default router;
