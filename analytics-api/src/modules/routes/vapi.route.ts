import { FastifyInstance } from "fastify";
import { vapiWebhookHandler } from "../controllers/vapi.controller";

export default async function vapiWebhookRoutes(app: FastifyInstance) {
  app.post('/create', {
    handler: vapiWebhookHandler,
  });
}