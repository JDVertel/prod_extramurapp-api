import { Router } from "express";
import authRoutes from "./auth.routes.js";
import contratosRoutes from "./contratos.routes.js";
import healthRoutes from "./health.routes.js";
import informesRoutes from "./informes.routes.js";
import modulesRoutes from "./modules.routes.js";
import realtimeRoutes from "./realtime.routes.js";
import usersRoutes from "./users.routes.js";
import workflowRoutes from "./workflow.routes.js";

const router = Router();

router.use("/", healthRoutes);
router.use("/auth", authRoutes);
router.use("/users", usersRoutes);
router.use("/contratos", contratosRoutes);
router.use("/informes", informesRoutes);
router.use("/realtime", realtimeRoutes);
router.use("/workflow", workflowRoutes);
router.use("/", modulesRoutes);

export default router;