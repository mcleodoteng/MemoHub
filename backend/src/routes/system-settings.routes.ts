import { Router } from "express";
import {
  getSystemSettings,
  updateSystemSettings,
} from "../controllers/system-settings.controller.js";

const router = Router();

router.get("/settings", getSystemSettings);
router.put("/settings", updateSystemSettings);

export default router;
