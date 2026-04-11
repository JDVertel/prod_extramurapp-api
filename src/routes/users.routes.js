import { Router } from "express";
import {
  createUserController,
  deleteUserController,
  existsByDocumentController,
  existsByEmailController,
  getUserByIdController,
  listDelegatedProfessionalsController,
  listUsersController,
  unlockUserController,
  updateUserPasswordController,
  updateUserController,
} from "../controllers/users.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();

router.get("/exists/email/:email", asyncHandler(existsByEmailController));
router.get("/exists/document/:numDocumento", asyncHandler(existsByDocumentController));

router.use(requireAuth);

router.get("", asyncHandler(listUsersController));
router.get("/profesionales-delegados", asyncHandler(listDelegatedProfessionalsController));
router.patch("/:id/password", asyncHandler(updateUserPasswordController));
router.patch("/:id/unlock", asyncHandler(unlockUserController));
router.get("/:id", asyncHandler(getUserByIdController));
router.post("", asyncHandler(createUserController));
router.put("/:id", asyncHandler(updateUserController));
router.delete("/:id", asyncHandler(deleteUserController));

export default router;
