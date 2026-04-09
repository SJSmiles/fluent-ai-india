// src/app.ts
import 'dotenv/config';
import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import formbody from '@fastify/formbody';
import cors from '@fastify/cors';
import { registerRoutes } from './routes';
import { connectDB } from './database/mongo-connection';
import { CORS_CONFIG } from 'config/server-config';


export const buildApp = async () => {
  const app = Fastify({ logger: true });

  app.register(cors, CORS_CONFIG);
  app.register(formbody);
  app.register(websocket);

  await connectDB();
  await registerRoutes(app);

  return app;
};