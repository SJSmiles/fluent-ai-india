import Fastify from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import fastifyCors from '@fastify/cors';


import { connectDB } from './database/mongo-connection';
import { registerRoutes } from './routes';
import { CORS_CONFIG } from './config/server-config';

export const buildApp = async () => {
  const app = Fastify({ logger: false });
  // Enabling CORS
  app.register(fastifyCors, CORS_CONFIG);

  await connectDB();

  // Swagger setup
  app.register(fastifySwagger, {
    swagger: {
      info: {
        title: 'Analytics API',
        description: 'Fastify API with Swagger',
        version: '1.0.0',
      },
      host: `${process.env.HOST || 'localhost'}:${process.env.PORT || 3000}`,
      schemes: ['http'],
      consumes: ['application/json'],
      produces: ['application/json'],
      securityDefinitions: {
        authorization: {
          type: 'apiKey',
          name: 'authorization',
          in: 'header',
        },
      },
      security: [{ authorization: [] }],
    },
  });


  app.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'full',
      deepLinking: false,
    },
    staticCSP: true,
    transformStaticCSP: (header: any) => header,
  });




  await registerRoutes(app);

  return app;
};
