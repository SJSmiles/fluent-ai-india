import { FastifyInstance } from 'fastify';
import routes from './modules/routes/route';

export async function registerRoutes(app: FastifyInstance) {
  app.register(routes, { prefix: '/llm' });
}
