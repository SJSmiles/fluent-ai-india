import { Environment } from './config/environment';
import { Server } from './server';
import { initDB } from './database';


async function init() {
  try {
    await Server.ready();
    // Load database
    await initDB();
    await Server.listen({
      host: Environment.host,
      port: Environment.port
    });
  } catch (error) {
    console.error('Error Initializing server', error);
  }
}

init();
