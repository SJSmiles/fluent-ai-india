// modules/queue/workers/index.ts

import { registerEndCallWorker } from "./call.worker";
import { registerEndTestCallWorker } from "./testCall.worker";


export function bootstrapWorkers() {
    registerEndCallWorker();
    registerEndTestCallWorker();
    // registerOtherWorker(); // add more workers here as you scale
    console.log('🚀 All workers bootstrapped');
}