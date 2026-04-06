import { buildApp } from './app';
import dotenv from 'dotenv';
import { connectRedis } from './database/mongo-connection'
dotenv.config(); // Load .env variables

const startServer = async () => {
  const app = await buildApp();

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const host = process.env.HOST || '0.0.0.0';
  await connectRedis();

  try {
    await app.listen({ port, host });
    console.log(`🚀 Server is running at http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

startServer();
