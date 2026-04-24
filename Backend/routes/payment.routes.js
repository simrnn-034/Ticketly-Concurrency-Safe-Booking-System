import { initiatePayment, confirmPayment } from "../controllers/payment.controller.js";
import {authMiddleware} from "../middlewares/auth.js";
import express from "express";

const router = express.Router();

router.post("/initiate",authMiddleware,initiatePayment);
router.post("/confirm", authMiddleware, confirmPayment);

export default router;