import prisma from '../config/prisma.js';
import { eventQueue, notificationQueue } from '../queues/index.js';
import client from '../config/redis.js';
import EventGallery from '../models/EventGallery.js';

export const InsertEvent = async (organizerId, payload) => {
  const {
    title,
    description,
    eventDate,
    date_time,
    venue,
    category,
    categories,
    seatCategories
  } = payload;

  const eventDateValue = eventDate || date_time;
  const itemCategories = seatCategories || categories;

  if (!Array.isArray(itemCategories) || !itemCategories.length) {
    throw { message: 'Add at least one seating category.', status: 400 };
  }

  let totalSeats = 0;
  for (let categoryItem of itemCategories) {
    const rows = categoryItem.rows || [];
    const seatsPerRow = categoryItem.seatsPerRow || categoryItem.seats_per_row || 0;
    totalSeats += rows.length * seatsPerRow;
  }

  const event = await prisma.$transaction(async (trx) => {
    const newEvent = await trx.event.create({
      data: {
        title,
        description,
        eventDate: new Date(eventDateValue),
        category,
        venue,
        totalSeats,
        organizerId,
        status: 'draft'
      }
    });

    for (let categoryItem of itemCategories) {
      const rows = categoryItem.rows || [];
      const seatsPerRow = categoryItem.seatsPerRow || categoryItem.seats_per_row || 0;
      const categoryCreated = await trx.seatCategory.create({
        data: {
          categoryName: categoryItem.categoryName || categoryItem.name,
          price: categoryItem.price,
          eventId: newEvent.id,
          totalSeats: rows.length * seatsPerRow
        }
      });

      const seatValues = rows.flatMap(row =>
        Array.from({ length: seatsPerRow }, (_, i) => ({
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

  const events = await prisma.event.findMany({

    where: {
      status: 'published'
    },

    orderBy: {
      eventDate: 'asc'
    },

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

  const galleries =
  await EventGallery.find({
    eventId: {
      $in: events.map(event => event.id)
    }
  });

  const galleryMap = {};

  galleries.forEach(gallery => {
    galleryMap[gallery.eventId] = gallery;
  });

  const updatedEvents =
  events.map(event => ({

    ...event,

    thumbnail:
      galleryMap[event.id]?.images?.[0]?.url || null
  }));

  return updatedEvents;
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

  const gallery = await EventGallery.findOne({
    eventId
  });

  const eventWithImages = {
    ...event,
    images: gallery?.images || []
  };


  await client.set(`event:${eventId}`, JSON.stringify(eventWithImages), 'EX', 300);
  return eventWithImages;
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

export const getOrganizerEvents =
async (organizerId) => {

  const events =
  await prisma.event.findMany({

    where: {
      organizerId
    },

    orderBy: {
      eventDate: 'asc'
    },

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

  const galleries =
  await EventGallery.find({
    eventId: {
      $in: events.map(event => event.id)
    }
  });

  const galleryMap = {};

  galleries.forEach(gallery => {
    galleryMap[gallery.eventId] = gallery.images;
  });

  const updatedEvents =
  events.map(event => ({

    ...event,

    images:
      galleryMap[event.id] || []
  }));

  return updatedEvents;
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

export const uploadEventImages = async ({
  eventId,
  files 
})=>{
  const event = await prisma.event.findUnique({
    where: {id: eventId}
  });
  if(!event){
    throw (404,"Event Not Found")
  }
  if(!files || files.length == 0){
    throw new Error(400,"No images uploaded")
  }
  const imageData = files.map(file => ({
    url : file.path,
    publicId: file.filename
  }));

  let gallery = await EventGallery.findOne({
    eventId
  })
  if(gallery){
    gallery.images.push(...imageData);
    await gallery.save();
  }
  else{
    gallery = await EventGallery.create({
      eventId,
      images : imageData
    });
  }

  return gallery

}
