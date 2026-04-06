import { fastify as Fastify, FastifyReply, FastifyRequest } from 'fastify';
import fastifyCors from '@fastify/cors';
import formbody from '@fastify/formbody';
import fastifyMultipart from '@fastify/multipart';
import fastifyJwt from '@fastify/jwt';
import fastifyAuth from '@fastify/auth';
import fastifyCookie from '@fastify/cookie';

import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';

import { v4 as uuid } from 'uuid';

import Routes from './routes';
import { validateToken } from './common/jwt';

import { LOGGER_CONFIG, CORS_CONFIG, JWT_CONFIG } from './config/server-config';
import { Environment } from './config/environment';
import { connectRedis } from './database/mongo-connect';

export const Server = Fastify({
  genReqId: (req: any) => req.headers['x-request-id'] || uuid(),
  logger: LOGGER_CONFIG,
  disableRequestLogging: true,
  bodyLimit: 2 * 1024 * 1024 * 1024 //2gb
});

// Enabling CORS
Server.register(fastifyCors, CORS_CONFIG);
Server.log.info(CORS_CONFIG, 'Activating CORS');

// Add support for multipart form data

// @ts-ignore
Server.register(fastifyMultipart, {
  limits: {
    fieldNameSize: 100,
    fieldSize: 1000000,
    fields: 100,
    fileSize: 10000000000000,
    files: 2,
    headerPairs: 20000,
    parts: 100000
  }
});

// register cookie 
Server.register(fastifyCookie, {
  secret: Environment.COOKIE_SECRET,
  parseOptions: {
    httpOnly: true,
    secure: Environment.env === 'production',
    sameSite: 'strict'
  }
});

// Adds a content type parser
Server.register(formbody);

// Register Swagger documentation
Server.register(fastifySwagger, {
  openapi: {
    openapi: '3.0.0',
    info: {
      title: 'My API',
      version: '1.0.0',
      description: 'Fastify API with Swagger'
    },
    components: {
      securitySchemes: {
        authorization: {
          type: 'apiKey',
          in: 'header',
          name: 'authorization'
        }
      }
    },
    security: [{ authorization: [] }]
  }
});

Server.register(fastifySwaggerUi, {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'full',
    deepLinking: false
  },
  staticCSP: true,
  transformStaticCSP: (header) => header
});

Server.register(fastifyJwt, { secret: `${JWT_CONFIG.secret}` });

Server.decorate('asyncVerifyJWT', validateToken)
  .register(fastifyAuth)
  .after(async () => {
    try {
      await connectRedis();
      Server.log.info('Redis connected successfully');
    } catch (error: any) {
      Server.log.error(error, 'Failed to connect to Redis');
    }
    Server.register(Routes);
  });

Server.get('/', async () => {
  return '1';
});

Server.setErrorHandler((error: any, req: FastifyRequest, res: FastifyReply) => {
  Server.log.error(error, error.message);

  // Map custom error codes to HTTP status codes
  const statusCodeMap: any = {
    REMOTE_BAD_REQUEST: 400,
    REMOTE_UNAUTHORIZED: 401,
    REMOTE_FORBIDDEN: 403,
    REMOTE_NOT_FOUND: 404,
    FST_JWT_AUTHORIZATION_TOKEN_EXPIRED: 401
    // You can add more custom codes here
  };

  // Default to 500 if no valid code is found in the map
  const statusCode = statusCodeMap[error.code] || 500;
  // Send the response with the correct status code and error message
  res.status(statusCode).send({
    error: error.message || 'Internal Server Error',
    statusCode: statusCode,
    message: error.message || 'Internal Server Error'
  });
});
