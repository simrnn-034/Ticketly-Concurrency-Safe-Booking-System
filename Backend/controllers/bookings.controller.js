import {
  initiateBooking,
  confirmBooking,
  cancelBooking as cancelBookingService,
  getBooking as getBookingService,
  getUserBookings as getUserBookingsService,
  getActiveBookings as getActiveBookingsService
} from '../services/booking.service.js';

export const initiate = async (req, res) => {
  try {
    const { eventId, seatIds } = req.body;

    if (!eventId || !seatIds || !seatIds.length) {
      return res.status(400).json({ error: 'eventId and seatIds are required' });
    }

    const result = await initiateBooking(req.user.id, eventId, seatIds);
    return res.status(201).json({ success: true, data: result });

  } catch (err) {
    if (err.message.includes('not held') || err.message.includes('someone else')) {
      return res.status(403).json({ error: err.message });
    }
    if (err.message.includes('not found') || err.message.includes('no longer available')) {
      return res.status(409).json({ error: err.message });
    }
    if (err.message === 'You already have a pending booking') {
      return res.status(409).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
};

export const confirm = async (req, res) => {
  try {
    const { bookingId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;
    const paymentDetails = { razorpayPaymentId, razorpayOrderId, razorpaySignature };
    

     if (!bookingId || !razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
      return res.status(400).json({ error: 'All payment details are required' });
    }

    const result = await confirmBooking(req.user.id, bookingId, paymentDetails);
    return res.status(200).json({ success: true, data: result });

  } catch (err) {
    if (err.message === 'Booking not found') {
      return res.status(404).json({ error: err.message });
    }
    if (err.message === 'Unauthorized') {
      return res.status(403).json({ error: err.message });
    }
    if (err.message === 'Booking already processed') {
      return res.status(400).json({ error: err.message });
    }
    if (
      err.message === 'Seats are currently being processed, try again' ||
      err.message === 'One or more seats are no longer available'
    ) {
      return res.status(409).json({ error: err.message });
    }
    console.log(err);
    return res.status(500).json({ error: err.message });
  }
};

export const cancelBooking = async (req, res) => {
  try {
    const result = await cancelBookingService(req.user.id, req.params.id);
    return res.status(200).json({ success: true, data: result });

  } catch (err) {
    if (err.message === 'Booking not found') {
      return res.status(404).json({ error: err.message });
    }
    if (err.message === 'Unauthorized') {
      return res.status(403).json({ error: err.message });
    }
    if (
      err.message === 'Booking already cancelled' ||
      err.message === 'Only confirmed bookings can be cancelled'
    ) {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
};

export const getBooking = async (req, res) => {
  try {
    const result = await getBookingService(req.user.id, req.params.id);
    return res.status(200).json({ success: true, data: result });

  } catch (err) {
    if (err.message === 'Booking not found') {
      return res.status(404).json({ error: err.message });
    }
    if (err.message === 'Unauthorized') {
      return res.status(403).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
};

export const getUserBookings = async (req, res) => {
  try {
    const result = await getUserBookingsService(req.user.id);
    return res.status(200).json({ success: true, data: result });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const activeBookings = async (req,res) => {
  try {
    const userId = req.user.id;
    const result = await getActiveBookingsService(userId);
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};