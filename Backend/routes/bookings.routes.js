import express from 'express';
import {
  initiate,
  confirm,
  cancelBooking,
  getBooking,
  getUserBookings,
  activeBookings as getActiveBookings
} from '../controllers/bookings.controller.js';
import authMiddleware from '../middlewares/auth.js';

const router = express.Router();

router.post('/initiate', authMiddleware, initiate);
router.post('/confirm', authMiddleware, confirm);
router.get('/me', authMiddleware, getUserBookings);
router.get('/active',authMiddleware, getActiveBookings);
router.get('/:id', authMiddleware, getBooking);
router.delete('/:id', authMiddleware, cancelBooking);


export default router;