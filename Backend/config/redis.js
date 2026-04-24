import Redis from 'ioredis';

const client = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
  maxRetriesPerRequest: 3
});

client.on('connect', () => console.log('Connected to Redis!'));
client.on('error', (err) => console.error('Redis error:', err));

export const bullConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  maxRetriesPerRequest: null
};

export default client;