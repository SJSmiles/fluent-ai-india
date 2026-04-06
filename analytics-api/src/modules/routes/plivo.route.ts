import { FastifyInstance } from "fastify";
import { plivoWebhookHandler } from "../controllers/plivo.controller";

export default async function plivoWebhookRoutes(app: FastifyInstance) {
  app.post('/create', {
    handler: plivoWebhookHandler,
  });
}