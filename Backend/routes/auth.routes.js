import express from 'express';
import { register, login, logout } from '../controllers/auth.controller.js';
import authMiddleware from '../middlewares/auth.js';
import { authLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/logout', authMiddleware, logout);

export default router;