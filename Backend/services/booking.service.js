import redlock from "../config/redlock.js";
import prisma from "../config/prisma.js";
import client from "../config/redis.js";
import { verifyHolds } from "./seats.service.js";
import { notificationQueue } from "../queues/index.js";


const initiateBooking = async (userId, eventId, seatIds) =>{
    const activeBooking = await client.get(`active-booking:${userId}`);
  if (activeBooking) throw new Error('You already have a pending booking');
    // verify all holds exist and belong to this user
    await verifyHolds(userId, eventId, seatIds);

    // fetch seats with category price
    const seats = await prisma.seat.findMany({
        where : {id: {in: seatIds}},
        include: {category: true}
    });

    if(seats.length !== seatIds.length){
        throw new Error('one or more seats not found');
    }

    // check all seats are still available in DB
    const unavailable = seats.filter(s=> s.status !== 'available');
    if(unavailable.length > 0){
        throw new Error('One or more seats are no longer available');
    }

    // calculate total amount
    const totalAmount = seats.reduce((sum ,seat)=>{
        return sum + Number(seat.category.price);
    }, 0);

    // create pending booking with bookingSeats in one transaction
    const booking = await prisma.$transaction(async (trx)=>{
        const newBooking = await trx.booking.create({
            data:{
                userId,
                eventId,
                status: 'pending',
                totalAmount, 
                paymentRef: 'pending',
                expiresAt: new Date(Date.now() + 10*60*1000),
                bookingSeats:{
                    create: seats.map(seat =>({
                        seatId: seat.id,
                        pricePaid: seat.category.price
                    }))
                }
            }
        });


        return newBooking;
    });

    await client.set(
  `active-booking:${userId}`,
  booking.id,
  'EX', 600  
);
    return{
        bookingId: booking.id,
        totalAmount,
        expiresAt: booking.expiresAt
    };

};

const confirmBooking = async (userId, bookingId) =>{
    const booking = await prisma.booking.findUnique({
        where: {id: bookingId},
        include: {seats: true}
    });

    if(!booking) throw new Error("Booking not Found");
    if(booking.userId !== userId) throw new Error("Unauthorized");
    if(booking.status !== 'pending') throw new Error('Booking already processed');

    const seatIds = booking.seats.map(s => s.seatId);

    // acquire locks
    const lockKeys = seatIds.map(id => `lock:seat:${id}`);
    let lock;

    try{
        lock = await redlock.acquire(lockKeys,10000);
    }
    catch(err){
        throw new Error('Seats are currently being processed, try again');
    }

    try{
        await prisma.$transaction(async (trx)=>{

            const seats = await trx.$queryRaw`
            SELECT id, status From "Seat"
            WHERE id = ANY(${seatIds}::uuid[])
            FOR UPDATE
            `;

            const unavailable = seats.filter(s=> s.status !=='available');
            if(unavailable.length > 0){
                throw new Error('One or more seats are no longer available');
            }

            await trx.seat.updateMany({
                where: {id: {in:seatIds}},
                data: {status : 'booked'}
            });

            await trx.booking.update({
                where: {id: bookingId},
                data: {status: 'confirmed'}
            });
        });

        await Promise.all(
            seatIds.map(id => client.del(`hold:${booking.eventId}:${id}`))
        );
await client.del(`seatmap:${booking.eventId}`);

        await notificationQueue.add('booking-confirmation',{
            userId,
            bookingId,
            eventId: booking.eventId
        },
    {
        attempts: 3,
        backoff: {type: 'exponential', delay: 2000}
    })

        return {bookingId, status: 'confirmed'};
    }
    finally{
        await lock.release();
    }  
}

const cancelBooking = async (userId, bookingId) =>{
    const booking = await prisma.booking.findUnique({
        where : {id: bookingId},
        include: {seats: true}
    });

    if(!booking) throw new Error('Booking Not Found');
    if(booking.userId !== userId) throw new Error('Unauthorized');
    if(booking.status === 'cancelled') throw new Error('Booking Already Cancelled');
    if (booking.status !== 'confirmed') throw new Error('Only confirmed bookings can be cancelled');

    const seatIds = booking.seats.map(s => s.seatId);

    await prisma.$transaction(async (trx)=>{
        await trx.booking.update({
            where : {id: bookingId},
            data:{
                status: 'canacelled',
                paymentRef: 'refunded'
            }
        });

        await trx.seat.updateMany({
            where: {id: {in:seatIds}},
            data: {status: 'available'}
        });
    });


    await notificationQueue.add('booking-cancellation',{
        userId,
        bookingId,
        eventId: booking.eventId
    },
{
    attempts: 3,
    backoff: {type: 'exponential', delay: 2000}
})
    return {bookingId,status: 'cancelled'};
}

const getUserBookings = async (userId) => {
  const bookings = await prisma.booking.findMany({
    where: { userId },
    include: {
      BookingSeat: {
        include: {
          seat: {
            include: { category: true }
          }
        }
      },
      event: {
        select: {
          id: true,
          title: true,
          venue: true,
          eventDate: true,
          status: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return bookings;
};

const getBooking = async (userId, bookingId) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      seats: {
        include: {
          seat: {
            include: { category: true }
          }
        }
      },
      event: {
        select: {
          id: true,
          title: true,
          venue: true,
          eventDate: true,
          status: true
        }
      }
    }
  });

  if (!booking) throw new Error('Booking not found');
  if (booking.userId !== userId) throw new Error('Unauthorized');

  return booking;
};

export { initiateBooking, confirmBooking , cancelBooking, getBooking, getUserBookings};