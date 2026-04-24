import { Router } from "express";
import {
    getRecommendations,
    generateDescription
}
from "../controllers/ai.controller.js";
import authMiddleware from "../middlewares/auth.js";
import { aiLimiter } from "../middlewares/rateLimiter.js";

const router = Router();
router.get("/recommendations",authMiddleware,aiLimiter, getRecommendations);
router.post('/generate-description', authMiddleware, aiLimiter, generateDescription);
export default router;