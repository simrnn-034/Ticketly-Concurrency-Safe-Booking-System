import {Worker} from 'bullmq';
import { sendBookingConfirmationEmail, sendEventCancelledEmail, sendBookingCancellationEmail } from '../notifications/email.js';
import prisma from '../config/prisma.js';
import { worker } from 'node:cluster';
const connection = {
    host: process.env.REDIS_HOST,
    port : process.env.REDIS_PORT
};
const notificationWorker = new Worker('notification', async (job)=>{
    if(job.name === 'booking-confirmation'){
        const {userId, bookingId, eventId} = job.data;
        const user = await prisma.user.findUnique({
            where : {id : userId},
            select: {email : true}
        });

        const event = await prisma.event.findUnique({
            where: {id : eventId},
            select : {title: true}
        });

        if(!user || !event) return;
        await sendBookingConfirmationEmail(user.email, bookingId, event.title);
    }

    if(job.name === 'booking-cancellation'){
         const {userId, bookingId, eventId} = job.data;
        const user = await prisma.user.findUnique({
            where : {id : userId},
            select: {email : true}
        });

        const event = await prisma.event.findUnique({
            where: {id : eventId},
            select : {title: true}
        });

        if(!user || !event) return;
        await sendBookingCancellationEmail(user.email, bookingId, event.title);
    }

    if(job.name === 'event-cancellation'){
        const {eventId} = job.data;

        const event = await prisma.event.findUnique({
            where: {id: eventId},
            select : {title: true}
        });

        if(!event) return;

        const bookings = await prisma.booking.findMany({
            where: {
                eventId,
                status: 'cancelled',
            },
            include:{
                user:{
                    select: {email: true}
                }
            }
        });

        await Promise.all(
            bookings.map(bookings =>
                sendEventCancelledEmail(booking.user.email, event.title)
            )
        );
    }
}, {connection});

notificationWorker.on('completed', (job) =>{
    console.log(`Notification job ${job.id} completed`);
});

notificationWorker.on('failed',(job, err)=>{
    console.error(`Notification job ${job.id} failed:`, err.message);
});

export default notificationWorker;