import mongoose from 'mongoose';
import Redis from 'ioredis';
import { Server } from '../server';
import { Environment } from '../config/environment';

let database: mongoose.Connection;
let redisClient: Redis | null = null;

export const connectDB = async () => {
  const uri: any = Environment.database.mongoUri;
  if (database) {
    return;
  }

  mongoose.connection.on('connected', () => {
    Server.log.info({ actor: 'MongoDB' }, 'Connected to database');
  });

  mongoose.connection.on('disconnected', () => {
    Server.log.error({ actor: 'MongoDB' }, 'Error connecting to database');
  });

  await mongoose.connect(uri, {
    autoIndex: false, // Don't build indexes
    maxPoolSize: 10, // Maintain up to 10 socket connections
    serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
    socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    family: 4 // Use IPv4, skip trying IPv6,
  });

  database = mongoose.connection;
  Server.log.info({ DB: database?.name }, 'Database Name');

  if (Environment.env === 'development') {
    mongoose.set('debug', true);
  }
};

export const connectRedis = async () => {
  if (redisClient) {
    return redisClient;
  }

  try {
    redisClient = new Redis({
      host: Environment.redis.host || 'localhost',
      port: Environment.redis.port || 6379,
      password: Environment.redis.password || undefined,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    redisClient.on('connect', () => {
      Server.log.info({ actor: 'Redis' }, 'Connected to Redis');
    });

    redisClient.on('error', (err) => {
      Server.log.error({ actor: 'Redis', error: err.message }, 'Redis connection error');
    });

    redisClient.on('ready', () => {
      Server.log.info({ actor: 'Redis' }, 'Redis client ready');
    });

    return redisClient;
  } catch (error: any) {
    Server.log.error({ actor: 'Redis', error: error.message }, 'Failed to connect to Redis');
    throw error;
  }
};

export const getRedisClient = (): Redis => {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call connectRedis() first.');
  }
  return redisClient;
};

export const disconnectDB = async () => {
  if (database) {
    await mongoose.disconnect();
  }

  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    Server.log.info({ actor: 'Redis' }, 'Disconnected from Redis');
  }
};