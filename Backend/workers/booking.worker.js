import { Worker } from 'bullmq';
import prisma from '../config/prisma.js';
import client from '../config/redis.js';
import { bullConnection } from '../config/redis.js';

new Worker('bookings', async (job) => {
  
  if (job.name === 'expire-booking') {
  const { bookingId, userId, eventId, seatIds } = job.data;

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.status !== 'pending') return; 

  await prisma.$transaction(async (trx) => {
    await trx.booking.update({
      where: { id: bookingId },
      data: { status: 'cancelled' }
    });
    await trx.seat.updateMany({
      where: { id: { in: seatIds } },
      data: { status: 'available' } 
    });
  });

  await client.del(`active-booking:${userId}`);
  await client.del(`seatmap:${eventId}`);
}

if (job.name === 'cleanup-expired-bookings') {
  const now = new Date();

  // find all expired pending bookings
  const expired = await prisma.booking.findMany({
    where: { status: 'pending', expiresAt: { lte: now } },
    include: { bookingSeats: true }
  });

  for (const booking of expired) {
    const seatIds = booking.bookingSeats.map(s => s.seatId);

    await prisma.$transaction(async (trx) => {
      await trx.booking.update({
        where: { id: booking.id },
        data: { status: 'cancelled' }
      });
      await trx.seat.updateMany({
        where: { id: { in: seatIds } },
        data: { status: 'available' }
      });
    });

    await client.del(`active-booking:${booking.userId}`);
    await client.del(`seatmap:${booking.eventId}`);
  }

  console.log(`🧹 Cleaned ${expired.length} expired bookings`);
}

}, { connection: bullConnection });