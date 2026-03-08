import 'dotenv/config';
import app from './app.js';
import prisma from './config/prisma.js';
import client from './config/redis.js';

import './workers/notification.worker.js';
import './workers/event.worker.js';

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {

    await prisma.$connect();
    console.log('PostgreSQL connected');

    await client.ping();
    console.log('Redis connected');

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
};

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  await prisma.$disconnect();
  await client.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down...');
  await prisma.$disconnect();
  await client.quit();
  process.exit(0);
});

startServer();