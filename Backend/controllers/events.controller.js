import {
  InsertEvent,
  getEvents,
  getEventById as getEventByIdService,
  publishEvent as publishEventService,
  cancelEvent as cancelEventService,
  getOrganizerEvents as getOrganizerEventsService
} from '../services/events.service.js';

export const createEvent = async (req, res) => {
  try {
    const result = await InsertEvent(req.user.id, req.body);
    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
};

export const getAllEvents = async (req, res) => {
  try {
    const result = await getEvents();
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
};

export const getEventById = async (req, res) => {
  try {
    const result = await getEventByIdService(req.params.id);
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
};

export const publishEvent = async (req, res) => {
  try {
    const result = await publishEventService(req.user.id, req.params.id);
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
};

export const cancelEvent = async (req, res) => {
  try {
    const result = await cancelEventService(req.user.id, req.params.id);
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
};

export const getOrganizerEvents = async (req, res) => {
  try {
    const result = await getOrganizerEventsService(req.user.id);
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
};
