import { use } from 'react';
import prisma from '../config/prisma.js';

const InsertEvent = async (req, res) => {
    const organizerId = req.user.id;
    const { title, description, date_time, venue, categories } = req.body;
    let totalSeats = 0;
    for (let category of categories) {
        totalSeats += category.rows.length * category.seats_per_row;
    };
    try {
        const event = await prisma.$transaction(async (trx) => {
            const event = await trx.event.create({
                data: {
                    title
                    , description
                    , date_time: new Date(date_time)
                    , venue
                    , total_seats: totalSeats
                    , organizer_id: organizerId
                    , status: 'draft'
                }
            });
            const eventId = event.id;
            for (let category of categories) {
                const categoryCreated = await trx.seatCategory.create({
                    data: {
                        categoryName: category.name,
                        price: category.price,
                        eventId: eventId,
                        totalSeats: category.rows.length * category.seats_per_row
                    }
                });
                const categoryId = categoryCreated.id;
                const seatValues = [];
                for (let row of category.rows) {
                    for (let seatNum = 1; seatNum <= category.seats_per_row; seatNum++) {
                        seatValues.push({
                            eventId, categoryId, rowLabel: row, seatNumber: seatNum
                        });
                    }
                }
                await trx.seat.createMany({ data: seatValues });
            }
            return event;
        });
        return res.status(201).json({ message: 'Event created successfully' });
    }
    catch (err) {
        return res.status(500).json({ message: 'Error creating event', error: err.message });
    }
};

const getEvents = async () => {
    return await prisma.event.findMany({
        where: { status: 'published' },
        orderBy: { eventDate: 'asc' }
    });
};

const getEventById = async (eventId) => {
    const event = await prisma.event.findUnique({
        where: { id: eventId },
        include: {
            categories: true,
            organizer: {
                select: {
                    id: true,
                    name: true,
                    email: true
                }
            }
        }
    });
    if (!event) throw new Error('Event Not Found');
    return event;
}

const publishEvent = async (userId, eventId) => {
    const event = prisma.event.findUnique({
        where: { id: eventId }
    });

    if (!event) throw new Error('Event not found');
    if (event.organizerId !== userId) throw new Error('Unauthorized');
    if (event.status === 'published') throw new Error('Event already published');
    if (event.status === 'cancelled') throw new Error('Cannot publish a cancelled event');

    const updatedEvent = await prisma.event.update({
        where: { id: eventId },
        data: { status: 'published' }
    });

    return updatedEvent;
};

export const cancelEvent = async (userId, eventId) => {

  const event = await prisma.event.findUnique({
    where: { id: eventId }
  });

  if (!event) throw new Error('Event not found');
  if (event.organizerId !== userId) throw new Error('Unauthorized');
  if (event.status === 'cancelled') throw new Error('Event already cancelled');

  // cancel the event and all confirmed bookings in one transaction
  await prisma.$transaction(async (trx) => {

    // update event status
    await trx.event.update({
      where: { id: eventId },
      data: { status: 'cancelled' }
    });

    // find all confirmed bookings for this event
    const bookings = await trx.booking.findMany({
      where: { eventId, status: 'confirmed' },
      include: { seats: true }
    });

    const allSeatIds = bookings.flatMap(b => b.seats.map(s => s.seatId));

    // cancel all confirmed bookings
    await trx.booking.updateMany({
      where: { eventId, status: 'confirmed' },
      data: { status: 'cancelled', paymentStatus: 'refunded' }
    });

    // release all seats back to available
    if (allSeatIds.length > 0) {
      await trx.seat.updateMany({
        where: { id: { in: allSeatIds } },
        data: { status: 'available' }
      });
    }
  });

  // notify all affected users (plug in after BullMQ)
  // await notificationQueue.add('event-cancelled', { eventId })

  return { eventId, status: 'cancelled' };
};


export default { InsertEvent, getEvents, getEventById, publishEvent, cancelEvent};