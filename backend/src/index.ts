import { Environment } from './config/environment';
import { Server } from './server';
import { initDB } from './database';
import { batchCallProcessService } from './modules/batchCall/services/batchCallProcess.service';


async function init() {
  try {
    await Server.ready();
    // Load database
    await initDB();
    await Server.listen({
      host: Environment.host,
      port: Environment.port
    });
    const autoCheckIn = Number(Environment.AUTO_CHECK_IN_EVERY) || 60000

    // 🔁 Auto batch processor (runs every 1 minute)
    setInterval(async () => {
      console.log("⏱ Auto batch processor running...");
      await batchCallProcessService.processInProcessRecipients();
    }, autoCheckIn); // 1 minute
  } catch (error) {
    console.error('Error Initializing server', error);
    process.exit(1);
  }
}

init();
