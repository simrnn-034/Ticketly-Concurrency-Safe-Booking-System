import {Queue} from 'bullmq';
import {bullConnection} from '../config/redis.js';

export const notificationQueue = new Queue('notification',{connection: bullConnection});
export const ticketQueue = new Queue('tickets', {connection: bullConnection});
export const eventQueue = new Queue('events',{connection: bullConnection});
export const bookingQueue = new Queue('bookings',{connection: bullConnection});