import { connectDB } from './database/mongo-connect.js';

const { CRON_FILE = '' } = process.env;
console.log('Cron starting', CRON_FILE, new Date());

async function run() {
  try {
    await connectDB()

    const module = await import(`../src/crons/${CRON_FILE}`);
    console.log('cron module loaded:', CRON_FILE);

    if (typeof module.default === 'function') {
      await module.default();
    } else {
      throw new Error('Cron module does not export a default function.');
    }

    console.log('Cron ended', CRON_FILE, new Date());

  } catch (err) {
    console.log('cron err', err)
  } finally {
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit(0);
  }
}

run();