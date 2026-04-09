import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { ModuleLoader } from './common/modules-loader';

// Load all modules
import { module as companyModule } from './modules/company';
import { module as userModule } from './modules/users';
import { module as phoneNumberModule } from './modules/phone-number'
import { module as agentModule } from './modules/agent'

const loadRoutes: FastifyPluginAsync<any> = async (fastify: FastifyInstance) => {
  ModuleLoader.loadModule(fastify, companyModule);
  ModuleLoader.loadModule(fastify, userModule);
  ModuleLoader.loadModule(fastify, phoneNumberModule);
  ModuleLoader.loadModule(fastify, agentModule);
};

export default fp(loadRoutes);