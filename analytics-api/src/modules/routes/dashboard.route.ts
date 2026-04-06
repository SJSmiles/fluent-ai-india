import { FastifyInstance } from 'fastify';
import { dashboardHandler } from '../controllers/dashboard.controller'
import { dashboardCountRequest } from '../schema/dashboard.schema';

export default async function dashboardRoutes(app: FastifyInstance) {
  app.get('/count', dashboardCountRequest, dashboardHandler);
}
