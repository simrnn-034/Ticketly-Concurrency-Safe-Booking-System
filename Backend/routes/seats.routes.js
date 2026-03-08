import express from 'express';
import {
  HoldSeat,
  ReleaseSeat,
  GetSeatMap
} from '../controllers/seats.controller.js';
import authMiddleware from '../middlewares/auth.js';
import { holdLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

router.get('/:eventId/seatmap', GetSeatMap);
router.post('/:eventId/hold', authMiddleware, holdLimiter, HoldSeat);
router.delete('/:eventId/hold', authMiddleware, ReleaseSeat);

export default router;