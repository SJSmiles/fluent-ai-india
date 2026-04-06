import { FastifyInstance } from "fastify";
import { smsWebhookHandler } from "../controllers/sms.controller";

export default async function smsWebhookRoutes(app: FastifyInstance) {
  app.post('/create', {
    handler: smsWebhookHandler,
  });
}