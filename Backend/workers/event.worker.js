import {Worker} from 'bullmq';
import prisma from '../config/prisma.js';
import {bullConnection} from '../config/redis.js';
const eventWorker = new Worker('events', async(job)=>{
  if(job.name==='complete-event'){
    const {eventId} = job.data;

    const event = await prisma.event.findUnique({
      where : {id: eventId}
    });
    if(!event) return;
    if(event.status !=='published') return;

    await prisma.event.update({
      where : {id: eventId},
      date: {status: 'completed'}
    });

    console.log(`Event ${eventId} marked as completed`);
  }
}, {connection: bullConnection});

eventWorker.on('failed',(err,job)=>{
  console.error(`Event Job ${job.id} failed`, err.message);
});

export default eventWorker;