import redlock from "../config/redlock.js";
import prisma from "../config/prisma.js";
import client from "../config/redis.js";
import { verifyHolds } from "./seats.service.js";
import { notificationQueue, bookingQueue } from "../queues/index.js";
import { Prisma } from '@prisma/client';
import {createOrder, verifyPayment} from "./payment.service.js";
import crypto from "crypto";

const initiateBooking = async (userId, eventId, seatIds) => {
    const activeBooking = await client.get(`active-booking:${userId}`);
    if (activeBooking) throw { message: 'You already have a pending booking', status: 409 };
    // verify all holds exist and belong to this user
    await verifyHolds(userId, eventId, seatIds);

    // fetch seats with category price
    const seats = await prisma.seat.findMany({
        where: { id: { in: seatIds } },
        include: { category: true }
    });

    if (seats.length !== seatIds.length) {
        throw { message: 'one or more seats not found', status: 404 };
    }

    // check all seats are still available in DB
    const unavailable = seats.filter(s => s.status !== 'available');
    if (unavailable.length > 0) {
        throw { message: 'One or more seats are no longer available', status: 409 };
    }

    // calculate total amount
    const totalAmount = seats.reduce((sum, seat) => {
        return sum + Number(seat.category.price);
    }, 0);

    const razorpayOrder = await createOrder(totalAmount,'INR',`receipt_${Date.now()}`);

    // create pending booking with bookingSeats in one transaction
    const booking = await prisma.$transaction(async (trx) => {
        const newBooking = await trx.booking.create({
            data: {
                userId,
                eventId,
                status: 'pending',
                totalPrice: totalAmount,
                paymentRef: 'pending',
                razorpayOrderId: razorpayOrder.id,
                expiresAt: new Date(Date.now() + 10 * 60 * 1000),
                bookingSeats: {
                    create: seats.map(seat => ({
                        seatId: seat.id,
                        pricePaid: seat.category.price
                    }))
                }
            }
        });

        await trx.seat.updateMany({
        where: { id: { in: seatIds } },
        data: { status: 'held' }
    });

        return newBooking;
    });



    await bookingQueue.add('expire-booking', {
        bookingId: booking.id,
        userId,
        eventId,
        seatIds
    }, {
        delay: 10 * 60 * 1000,
        jobId: `expire-booking-${booking.id}`
    });

    await client.set(
        `active-booking:${userId}`,
        booking.id,
        'EX', 600
    );
    return {
        bookingId: booking.id,
        totalAmount,
        expiresAt: booking.expiresAt,
        razorpayOrderId: razorpayOrder.id,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID
    };

};

const confirmBooking = async (userId, bookingId,paymentDetails) => {
    const { razorpayPaymentId, razorpayOrderId, razorpaySignature } = paymentDetails;
    if(!razorpayOrderId||!razorpayPaymentId||!razorpaySignature){
        throw { message: 'Payment details required', status: 400 };
    }

    const checkSignature = await verifyPayment(razorpayPaymentId,razorpayOrderId,razorpaySignature);
    if(!checkSignature){
        throw { message: 'Payment verification failed - invalid signature', status: 400 };
    }
    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { bookingSeats: true }
    });

    if (!booking) throw { message: "Booking not Found", status: 404 };
    if (booking.userId !== userId) throw { message: "Unauthorized", status: 401 };
    if (booking.status !== 'pending') throw { message: 'Booking already processed', status: 409 };
    if(booking.razorpayOrderId !== razorpayOrderId){
        throw { message: 'Payment order mismatch', status: 400 };
    }
    const seatIds = booking.bookingSeats.map(s => s.seatId);

    // acquire locks
    const lockKeys = seatIds.map(id => `lock:seat:${id}`);
    let lock;

    try {
        lock = await redlock.acquire(lockKeys, 10000);
    }
    catch (err) {
        throw { message: 'Seats are currently being processed, try again', status: 409 };
    }

    try {
        await prisma.$transaction(async (trx) => {

            const seats = await trx.$queryRaw(
    Prisma.sql`
        SELECT id, status
        FROM "Seat"
        WHERE id::text = ANY(${seatIds})
        FOR UPDATE
    `
);

           const unavailable = seats.filter(s => s.status === 'booked' || s.status === 'blocked'); 
            if (unavailable.length > 0) {
                throw { message: 'One or more seats are no longer available', status: 409 };
            }

            await trx.seat.updateMany({
                where: { id: { in: seatIds } },
                data: { status: 'booked' }
            });

            await trx.booking.update({
                where: { id: bookingId },
                data: { 
                    status: 'confirmed',
                    razorpayPaymentId,
                    razorpaySignature,
                    paymentRef: razorpayPaymentId
                 }
            });
        });

        await Promise.all(
            seatIds.map(id => client.del(`hold:${booking.eventId}:${id}`))
        );
        await client.del(`seatmap:${booking.eventId}`);
        await client.del(`active-booking:${userId}`);
        await client.del(`recommendations:${userId}`);

        const job = await bookingQueue.getJob(`expire-booking-${bookingId}`);
        if (job) await job.remove();

        await notificationQueue.add('booking-confirmation', {
            userId,
            bookingId,
            eventId: booking.eventId
        },
            {
                attempts: 3,
                backoff: { type: 'exponential', delay: 2000 }
            })

        return { bookingId, status: 'confirmed' };
    }
    finally {
        await lock.release();
    }
}

const cancelBooking = async (userId, bookingId) => {
    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { bookingSeats: true }
    });

    if (!booking) throw { message: "Booking not Found", status: 404 };
    if (booking.userId !== userId) throw { message: "Unauthorized", status: 401 };
    if (booking.status === 'cancelled') throw { message: 'Booking Already Cancelled', status: 409 };
    if (!['confirmed','pending'].includes(booking.status)) throw { message: 'Only confirmed or pending bookings can be cancelled', status: 400 };


    const seatIds = booking.bookingSeats.map(s => s.seatId);

    await prisma.$transaction(async (trx) => {
        await trx.booking.update({
            where: { id: bookingId },
            data: {
                status: 'cancelled',
                paymentRef: 'refunded'
            }
        });

        await trx.seat.updateMany({
            where: { id: { in: seatIds } },
            data: { status: 'available' }
        });
    });

    const job = await bookingQueue.getJob(`expire-booking-${bookingId}`);
    if (job) await job.remove();

    await client.del(`active-booking:${userId}`);
    await client.del(`seatmap:${booking.eventId}`);
    await client.del(`hold:${booking.eventId}:${seatIds.join(',')}`);

    await notificationQueue.add('booking-cancellation', {
        userId,
        bookingId,
        eventId: booking.eventId
    },
        {
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 }
        })
    return { bookingId, status: 'cancelled' };
}

const getUserBookings = async (userId) => {
    const bookings = await prisma.booking.findMany({
        where: { userId ,
            OR: [
                { status: { not: 'pending' } }, // confirmed/cancelled
    {
      status: 'pending',
      expiresAt: { gt: new Date() } 
    }
            ]
         } ,
        include: {
            bookingSeats: {
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
            bookingSeats: {
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

const scheduleCleanupJob = async () => {
    await bookingQueue.add('cleanup-expired-bookings', {}, {
        repeat: { cron: '0 0 * * *' },
        jobId: 'cleanup-expired-bookings'
    });
}

const getActiveBookings = async (userId) => {
  const now = new Date();

  // mark any expired pending bookings as cancelled
  await prisma.booking.updateMany({
    where: {
      userId,
      status: 'pending',
      expiresAt: { lte: now }  // expired ones
    },
    data: { status: 'cancelled' }
  });

  // now return only valid pending booking
  const booking = await prisma.booking.findFirst({
    where: {
      userId,
      status: 'pending',
      expiresAt: { gt: now }
    },
    include: {
      bookingSeats: {
        include: { seat: { include: { category: true } } }
      },
      event: {
        select: { id: true, title: true, venue: true, eventDate: true }
      }
    }
  });
  booking.razorpayKeyId = process.env.RAZORPAY_KEY_ID; 

  return {
    booking,
    
  }; // single booking, not array — only one active allowed
};


export { initiateBooking, confirmBooking, cancelBooking, getBooking, getUserBookings, scheduleCleanupJob, getActiveBookings };