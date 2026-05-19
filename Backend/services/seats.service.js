import client from "../config/redis.js";
import prisma from "../config/prisma.js";
import { emitSeatUpdate } from '../config/socket.js';

export const holdSeats = async (userId, eventId, seatIds) => {
  const existingBooking = await prisma.booking.findFirst({
  where: {
    userId,
    status: 'pending'
  }
});

if (existingBooking) {
  throw new Error({ message: 'Complete or cancel existing booking first', status: 409 });
}
  const heldSoFar = [];

  for (let seatId of seatIds) {
    const holdKey = `hold:${eventId}:${seatId}`;
    const existing = await client.get(holdKey);

    if (existing && existing !== userId) {
      for (let heldId of heldSoFar) {
        await client.del(`hold:${eventId}:${heldId}`);
      }
      throw new Error({ message: 'Seat already held', status: 409 });
    }

    if (existing === userId) {
      await client.expire(holdKey, 600);
      heldSoFar.push(seatId);
      continue;
    }

    const held = await client.set(holdKey, userId, 'EX', 600, 'NX');

    if (!held) {
      for (let heldId of heldSoFar) {
        await client.del(`hold:${eventId}:${heldId}`);
      }
      throw new Error({ message: 'Seat taken', status: 409 });
    }

    heldSoFar.push(seatId);
  }

  await client.del(`seatmap:${eventId}`);
  heldSoFar.forEach((seatId) => {
    emitSeatUpdate(eventId, seatId, {
      status: 'held',
      isHeld: true,
      heldBy: userId
    });
  });
};

export const releaseSeats = async (userId, eventId, seatIds) => {
  const releasedSeats = [];

  for (let seatId of seatIds) {
    const holdKey = `hold:${eventId}:${seatId}`;
    const existing = await client.get(holdKey);

    if (existing === userId) {
      await client.del(holdKey);
      releasedSeats.push(seatId);
    }
  }

  if (releasedSeats.length) {
    await client.del(`seatmap:${eventId}`);
    releasedSeats.forEach((seatId) => {
      emitSeatUpdate(eventId, seatId, {
        status: 'available',
        isHeld: false,
        heldBy: null
      });
    });
  }
};

export const verifyHolds = async (userId, eventId, seatIds) => {
  for (let seatId of seatIds) {
    const holdKey = `hold:${eventId}:${seatId}`;
    const heldBy = await client.get(holdKey);

    if (!heldBy) throw new Error(`Seat ${seatId} is not held`);
    if (heldBy !== userId) throw new Error(`Seat ${seatId} is held by someone else`);
  }
};

export const getSeatMap = async (eventId, userId) => {
  const cached = await client.get(`seatmap:${eventId}`);
  if(cached) return JSON.parse(cached);

  const seats = await prisma.seat.findMany({
    where: { eventId },
    include: { category: true }
  });

  const seatsWithHoldStatus = await Promise.all(
    seats.map(async (seat) => {
      const holdKey = `hold:${eventId}:${seat.id}`;
      const heldBy = await client.get(holdKey);
     return {
    ...seat,
    isHeld: !!heldBy,
    heldBy: heldBy || null
};
    })
  );

  const groupedByRow = seatsWithHoldStatus.reduce((acc, seat) => {
    if (!acc[seat.rowLabel]) acc[seat.rowLabel] = [];
    acc[seat.rowLabel].push(seat);
    return acc;
  }, {});

  await client.set(`seatmap:${eventId}`,JSON.stringify(groupedByRow),'EX',60);
  
  return groupedByRow;
};