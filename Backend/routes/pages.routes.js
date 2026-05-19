import express from 'express';
import {getRecommendations} from '../services/ai.service.js';
import {getEvents, getOrganizerEvents} from '../services/events.service.js';
import {getUserBookings, getBooking} from '../services/booking.service.js';
import { renderEventPage } from '../controllers/pages.controller.js';
import { aiLimiter } from '../middlewares/rateLimiter.js';


const router = express.Router();

router.get('/', async (req, res) => {
  const user = req.user;

  const events = await getEvents();

  let recommendations = [];
  if (user) {
    recommendations = await getRecommendations(user.id);
  }

  res.render('index', {
    user,
    events,
    recommendations
  });
});

router.get('/organizer', async (req, res) => {
  res.render('organizer', { user: req.user , events: await getOrganizerEvents(req.user.id) });
});

router.get('/bookings', async (req, res) => {
  const user = req.user;
  const bookings = user ? await getUserBookings(user.id) : [];
  res.render('bookings', { user, bookings });
});

router.get('/booking', async (req, res) => {
  const user = req.user;
  const bookingId = req.query.id;
  if (!user) {
    return res.redirect('/auth');
  }
  const booking = await getBooking(user.id, bookingId);
  res.render('booking-details', { user, booking });
});

router.get("/event/:id", renderEventPage);

router.get('/auth', async (req, res) => {
  res.render('auth');
});

export default router;