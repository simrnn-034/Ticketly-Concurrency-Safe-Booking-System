import prisma from '../config/prisma.js';
import { eventQueue, notificationQueue } from '../queues/index.js';
import client from '../config/redis.js';

export const InsertEvent = async (organizerId, { title, description, date_time, venue, categories }) => {
  let totalSeats = 0;
  for (let category of categories) {
    totalSeats += category.rows.length * category.seats_per_row;
  }

  const event = await prisma.$transaction(async (trx) => {
    const newEvent = await trx.event.create({
      data: {
        title,
        description,
        eventDate: new Date(date_time),
        category,
        venue,
        totalSeats,
        organizerId,
        status: 'draft'
      }
    });

    for (let category of categories) {
      const categoryCreated = await trx.seatCategory.create({
        data: {
          categoryName: category.name,
          price: category.price,
          eventId: newEvent.id,
          totalSeats: category.rows.length * category.seats_per_row
        }
      });

      const seatValues = category.rows.flatMap(row =>
        Array.from({ length: category.seats_per_row }, (_, i) => ({
          eventId: newEvent.id,
          categoryId: categoryCreated.id,
          rowLabel: row,
          seatNumber: i + 1
        }))
      );

      await trx.seat.createMany({ data: seatValues });
    }

    return newEvent;
  });

  return event;
};

export const getEvents = async () => {
  return await prisma.event.findMany({
    where: { status: 'published'},
    orderBy: { eventDate: 'asc' },
    include: {
      seatCategories: {
        select: {
          id: true,
          categoryName: true,
          price: true
        }
      }
    }
  });
};

export const getEventById = async (eventId) => {
  const cached = await client.get(`event:${eventId}`);  
  if (cached) return JSON.parse(cached);

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      seatCategories: true,
      organizer: {
        select: { id: true, name: true, email: true }
      }
    }
  });

  if (!event) throw { message: 'Event not found', status: 404 };

  await client.set(`event:${eventId}`, JSON.stringify(event), 'EX', 300);
  return event;
};

export const publishEvent = async (userId, eventId) => {
  const event = await prisma.event.findUnique({
    where: { id: eventId }
  });

  if (!event) throw { message: 'Event not found', status: 404 };
  if (event.organizerId !== userId) throw { message: 'Unauthorized', status: 401 };
  if (event.status === 'published') throw { message: 'Event already published', status: 409 };
  if (event.status === 'cancelled') throw { message: 'Cannot publish a cancelled event', status: 400 };

    const delay = new Date(event.eventDate).getTime() - Date.now();

  if (delay <= 0) throw { message: 'Event date has already passed', status: 400 };
  const updatedEvent = await prisma.event.update({
    where: { id: eventId },
    data: { status: 'published' }
  });


  await eventQueue.add('complete-event', { eventId }, {
    delay,
    jobId: `complete-event-${eventId}`
  });

  return updatedEvent;
};

export const getOrganizerEvents = async (organizerId) => {
  return await prisma.event.findMany({
    where: { organizerId }, 
    orderBy: { eventDate: 'asc' },
    include: {
      seatCategories: {
        select: {
          id: true,
          categoryName: true,
          price: true

        }
      }
    }
  });
};

export const cancelEvent = async (userId, eventId) => {
  const event = await prisma.event.findUnique({
    where: { id: eventId }
  });

  if (!event) throw { message: 'Event not found', status: 404 };
  if (event.organizerId !== userId) throw { message: 'Unauthorized', status: 401 };
  if (event.status === 'cancelled') throw { message: 'Event already cancelled', status: 409 };

  await prisma.$transaction(async (trx) => {
    await trx.event.update({
      where: { id: eventId },
      data: { status: 'cancelled' }
    });

    const bookings = await trx.booking.findMany({
      where: { eventId, status: 'confirmed' },
      include: { seats: true }
    });

    const allSeatIds = bookings.flatMap(b => b.seats.map(s => s.seatId));

    await trx.booking.updateMany({
      where: { eventId, status: 'confirmed' },
      data: { status: 'cancelled', paymentStatus: 'refunded' }
    });

    if (allSeatIds.length > 0) {
      await trx.seat.updateMany({
        where: { id: { in: allSeatIds } },
        data: { status: 'available' }
      });
    }
  });

  await notificationQueue.add('event-cancelled', { eventId }, {  // ← fixed job name
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 }
  });

  return { eventId, status: 'cancelled' };
};

