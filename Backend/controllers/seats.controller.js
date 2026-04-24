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
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
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
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
};

export const GetSeatMap = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.id;
    const data = await getSeatMap(eventId, userId);
    return res.status(200).json({ success: true, data });

  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
};