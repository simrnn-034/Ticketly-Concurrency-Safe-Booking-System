import express from 'express';
import {
  createEvent,
  getAllEvents,
  getEventById,
  publishEvent,
  cancelEvent,
  getOrganizerEvents,
  uploadEventImages
} from '../controllers/events.controller.js';
import authMiddleware from '../middlewares/auth.js';
import roleMiddleware from '../middlewares/roles.js';
import { eventUpload } from '../config/cloudinary.js';

const router = express.Router();

router.get('/', getAllEvents);
router.get('/me', authMiddleware, roleMiddleware('organizer'), getOrganizerEvents);
router.get('/:id', getEventById);
router.post('/', authMiddleware, roleMiddleware('organizer'), createEvent);
router.patch('/:id/publish', authMiddleware, roleMiddleware('organizer'), publishEvent);
router.patch('/:id/cancel', authMiddleware, roleMiddleware('organizer'), cancelEvent);
router.post('/:eventId/images',authMiddleware,eventUpload.array("images",5),
uploadEventImages);


export default router;