import { Router } from "express";
import {
  deleteRealtimeController,
  getRealtimeController,
  patchRealtimeController,
  postRealtimeController,
  putRealtimeController,
} from "../controllers/realtime.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();

router.get(["/ips", "/ips.json", "/ips/:id", "/ips/:id.json"], asyncHandler(getRealtimeController));

router.use(requireAuth);

router.get("/*", asyncHandler(getRealtimeController));
router.post("/*", asyncHandler(postRealtimeController));
router.put("/*", asyncHandler(putRealtimeController));
router.patch("/*", asyncHandler(patchRealtimeController));
router.delete("/*", asyncHandler(deleteRealtimeController));

export default router;
