import { Router } from "express";
import {
  createReminder,
  deleteReminder,
  getReminders,
} from "../controllers/reminder.controller.js";

const router = Router();

router.get("/", getReminders);
router.post("/", createReminder);
router.delete("/:id", deleteReminder);

export default router;
