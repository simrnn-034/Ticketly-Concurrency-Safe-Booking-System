import {
  holdSeats,
  releaseSeats,
  getSeatMap
} from '../services/seats.service.js';

export const HoldSeat = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { seatIds } = req.body;

    if (!seatIds || !seatIds.length) {
      return res.status(400).json({ error: 'seatIds are required' });
    }

    await holdSeats(req.user.id, eventId, seatIds);
    return res.status(200).json({ success: true });

  } catch (err) {
    if (err.message === 'Seat already held' || err.message === 'Seat taken') {
      return res.status(409).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
};

export const ReleaseSeat = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { seatIds } = req.body;

    if (!seatIds || !seatIds.length) {
      return res.status(400).json({ error: 'seatIds are required' });
    }

    await releaseSeats(req.user.id, eventId, seatIds);
    return res.status(200).json({ success: true });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const GetSeatMap = async (req, res) => {
  try {
    const { eventId } = req.params;
    const data = await getSeatMap(eventId);
    return res.status(200).json({ success: true, data });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};