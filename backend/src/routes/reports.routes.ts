import { Router } from "express";
import { getReportsSource } from "../controllers/reports.controller.js";

const router = Router();

router.get("/source", getReportsSource as any);

export default router;
