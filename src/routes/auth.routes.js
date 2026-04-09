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

router.post("/register-admin", asyncHandler(registerAdminController));
router.post("/login", asyncHandler(loginController));
router.post("/request-password-reset", asyncHandler(requestPasswordResetController));
router.post("/reset-password", asyncHandler(resetPasswordController));
router.post("/change-password", requireAuth, asyncHandler(changePasswordController));

export default router;
