import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { ModuleLoader } from './common/modules-loader';

// Load all modules
import { module as companyModule } from './modules/company';
import { module as userModule } from './modules/users';
import { module as callModule } from './modules/call';
import { module as webhookModule } from './modules/webhook';
import { module as agentModule } from './modules/agent';
import { module as batchCallModule } from './modules/batchCall';
import { module as blackListModule } from './modules/black-list'
import { module as contactModule } from './modules/contact'
import { module as messageModule } from './modules/message'
import { module as phoneNumberModule } from './modules/phone-number'

const loadRoutes: FastifyPluginAsync<any> = async (fastify: FastifyInstance) => {
  ModuleLoader.loadModule(fastify, companyModule);
  ModuleLoader.loadModule(fastify, userModule);
  ModuleLoader.loadModule(fastify, webhookModule);
  ModuleLoader.loadModule(fastify, callModule);
  ModuleLoader.loadModule(fastify, agentModule);
  ModuleLoader.loadModule(fastify, batchCallModule);
  ModuleLoader.loadModule(fastify, blackListModule);
  ModuleLoader.loadModule(fastify, contactModule);
  ModuleLoader.loadModule(fastify, messageModule);
  ModuleLoader.loadModule(fastify, phoneNumberModule);
};

export default fp(loadRoutes);