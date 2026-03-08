import {
  InsertEvent,
  getEvents,
  getEventById as getEventByIdService,
  publishEvent as publishEventService,
  cancelEvent as cancelEventService
} from '../services/events.service.js';

export const createEvent = async (req, res) => {
  try {
    const result = await InsertEvent(req.user.id, req.body);
    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

export const getAllEvents = async (req, res) => {
  try {
    const result = await getEvents();
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const getEventById = async (req, res) => {
  try {
    const result = await getEventByIdService(req.params.id);
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    if (err.message === 'Event not found') {
      return res.status(404).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
};

export const publishEvent = async (req, res) => {
  try {
    const result = await publishEventService(req.user.id, req.params.id);
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    if (err.message === 'Event not found') {
      return res.status(404).json({ error: err.message });
    }
    if (err.message === 'Unauthorized') {
      return res.status(403).json({ error: err.message });
    }
    return res.status(400).json({ error: err.message });
  }
};

export const cancelEvent = async (req, res) => {
  try {
    const result = await cancelEventService(req.user.id, req.params.id);
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    if (err.message === 'Event not found') {
      return res.status(404).json({ error: err.message });
    }
    if (err.message === 'Unauthorized') {
      return res.status(403).json({ error: err.message });
    }
    return res.status(400).json({ error: err.message });
  }
};
