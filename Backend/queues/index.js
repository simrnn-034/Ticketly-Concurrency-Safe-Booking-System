import {Queue} from 'bullmq';
const connection = {
    host: process.env.REDIS_HOST,
    port : process.env.REDIS_PORT
};

export const notificationQueue = new Queue('notification',{connection});
export const ticketQueue = new Queue('tickets', {connection});
export const eventQueue = new Queue('events',{connection});