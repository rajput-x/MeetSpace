import { Router } from "express";
import { addToHistory, getUserHistory, login, register } from "../controllers/user.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

// Public routes
router.post("/login", login);
router.post("/register", register);

// Protected routes (require JWT)
router.post("/add_to_activity", authenticate, addToHistory);
router.get("/get_all_activity", authenticate, getUserHistory);

export default router;
