import { Router } from "express";
import {
  changePasswordController,
  loginController,
  registerAdminController,
  requestPasswordResetController,
  resetPasswordController,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();

// ------------------------------------------------------------
// Rutas PÚBLICAS (sin JWT)
// ------------------------------------------------------------
router.post("/register-admin", asyncHandler(registerAdminController));
router.post("/login", asyncHandler(loginController));
router.post("/request-password-reset", asyncHandler(requestPasswordResetController));
router.post("/reset-password", asyncHandler(resetPasswordController));

// ------------------------------------------------------------
// Rutas PROTEGIDAS (requieren Bearer token)
// ------------------------------------------------------------
router.post("/change-password", asyncHandler(requireAuth), asyncHandler(changePasswordController));

export default router;
