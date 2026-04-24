import express from 'express';
import {
  createEvent,
  getAllEvents,
  getEventById,
  publishEvent,
  cancelEvent,
  getOrganizerEvents
} from '../controllers/events.controller.js';
import authMiddleware from '../middlewares/auth.js';
import roleMiddleware from '../middlewares/roles.js';

const router = express.Router();

router.get('/', getAllEvents);
router.get('/me', authMiddleware, roleMiddleware('organizer'), getOrganizerEvents);
router.get('/:id', getEventById);
router.post('/', authMiddleware, roleMiddleware('organizer'), createEvent);
router.patch('/:id/publish', authMiddleware, roleMiddleware('organizer'), publishEvent);
router.patch('/:id/cancel', authMiddleware, roleMiddleware('organizer'), cancelEvent);


export default router;