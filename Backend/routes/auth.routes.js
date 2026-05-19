import express from 'express';
import { register, login, logout, me, updateProfile } from '../controllers/auth.controller.js';
import authMiddleware from '../middlewares/auth.js';
import { authLimiter } from '../middlewares/rateLimiter.js';
import { userUpload } from '../config/cloudinary.js';

const router = express.Router();

router.post('/register', authLimiter, register); // new user
router.post('/login', authLimiter, login); // login existing user
router.post('/logout', authMiddleware, logout); //logout user
router.get('/me', me); 
router.patch('/profile', authMiddleware, userUpload.single('image'), updateProfile); 


export default router;