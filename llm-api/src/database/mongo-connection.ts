import mongoose from 'mongoose';
import Redis from 'ioredis';
import { Environment } from '../config/environment';

let database: mongoose.Connection;
let redisClient: Redis | null = null;

export const connectDB = async () => {
  const uri: any = Environment.database.mongoUri;

  if (database) {
    return;
  }

  mongoose.connection.on('connected', () => {
    console.log({ actor: 'MongoDB' }, 'Connected to database');
  });

  mongoose.connection.on('disconnected', () => {
    console.log({ actor: 'MongoDB' }, 'Disconnected from database');
  });

  mongoose.connection.on('error', (error) => {
    console.log({ actor: 'MongoDB', error }, 'Error connecting to database');
  });

  await mongoose.connect(uri, {
    autoIndex: false,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4,
  });

  database = mongoose.connection;
  console.log({ DB: database?.name }, 'Database Name');

  if (Environment.env === 'development') {
    mongoose.set('debug', true);
  }
};

export const connectRedis = async (): Promise<Redis> => {
  if (redisClient) {
    return redisClient;
  }

  try {
    redisClient = new Redis({
      host: Environment.redis.host,
      port: Environment.redis.port,
      password: Environment.redis.password,
      username: Environment.redis.username,
      db: Environment.redis.db,
      retryStrategy(times: number) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    });

    await redisClient.ping();
    console.log({ actor: 'Redis' }, 'Connected to Redis');

    redisClient.on('error', (err) => {
      console.error({ actor: 'Redis', error: err.message }, 'Redis error');
    });

    redisClient.on('close', () => {
      console.log({ actor: 'Redis' }, 'Redis connection closed');
    });

    redisClient.on('reconnecting', () => {
      console.log({ actor: 'Redis' }, 'Reconnecting to Redis...');
    });

    return redisClient;
  } catch (error) {
    console.error({ actor: 'Redis', error }, 'Failed to connect to Redis');
    throw error;
  }
};

export const getRedisClient = (): Redis => {
  if (!redisClient) {
    throw new Error('Redis not initialized. Call connectRedis() first.');
  }
  return redisClient;
};

export const disconnectDB = async () => {
  if (!database) {
    return;
  }
  await mongoose.disconnect();
  console.log({ actor: 'MongoDB' }, 'MongoDB disconnected');
};

export const disconnectRedis = async () => {
  if (!redisClient) {
    return;
  }
  await redisClient.quit();
  redisClient = null;
  console.log({ actor: 'Redis' }, 'Redis disconnected');
};

export const disconnectAll = async () => {
  await Promise.all([
    disconnectDB(),
    disconnectRedis()
  ]);
  console.log('All connections closed');
};

export { redisClient };
export default mongoose;