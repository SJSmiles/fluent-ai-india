import { FastifyInstance } from 'fastify';
import { dashboardHandler } from 'modules/controllers/dashboard.controller';

export default async function dashboardRoutes(app: FastifyInstance) {
  app.get('/count', dashboardHandler);
}
