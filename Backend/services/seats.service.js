import client from "../config/redis.js";
import prisma from "../config/prisma.js";

export const holdSeats = async (userId, eventId, seatIds) => {
  const heldSoFar = [];

  for (let seatId of seatIds) {
    const holdKey = `hold:${eventId}:${seatId}`;
    const existing = await client.get(holdKey);

    if (existing) {
      for (let heldId of heldSoFar) {
        await client.del(`hold:${eventId}:${heldId}`);
      }
      throw new Error('Seat already held');
    }

    const held = await client.set(holdKey, userId, 'EX', 600, 'NX');

    if (!held) {
      for (let heldId of heldSoFar) {
        await client.del(`hold:${eventId}:${heldId}`);
      }
      throw new Error('Seat taken');
    }

    heldSoFar.push(seatId);
  }
};

export const releaseSeats = async (userId, eventId, seatIds) => {
  for (let seatId of seatIds) {
    const holdKey = `hold:${eventId}:${seatId}`;
    const existing = await client.get(holdKey);

    if (existing === userId) {
      await client.del(holdKey);
    }
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

export const getSeatMap = async (eventId) => {
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
        status: heldBy ? 'held' : seat.status
      };
    })
  );

  const groupedByRow = seatsWithHoldStatus.reduce((acc, seat) => {
    if (!acc[seat.rowLabel]) acc[seat.rowLabel] = [];
    acc[seat.rowLabel].push(seat);
    return acc;
  }, {});

  return groupedByRow;
};