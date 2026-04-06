import { AppModule } from './common-interfaces';

export class ModuleLoader {
  public static loadModule(Server: any, module: AppModule) {
    for (const route of module.routes) {
      let preHandler = {};
      let securityKeys = {};
      if (route.auth) {
        preHandler = {
          preHandler: Server.auth([Server.asyncVerifyJWT])
        };
        securityKeys = {
          headers: {
            type: 'object',
            required: ['authorization'],
            properties: {
              authorization: { type: 'string' }
            }
          },
          security: [
            {
              authorization: []
            }
          ]
        };
      }
      console.log(`Registering route: ${route.method} ${module.mountPoint}${route.url}`);
      Server.route({
        method: route.method,
        url: `${module.mountPoint}${route.url}`,
        schema: {
          ...route.schema,
          ...securityKeys
        },
        handler: route.handler,
        ...preHandler
      });
    }
  }
}
