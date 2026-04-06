import { Environment } from '../config/environment';
import { connectDB } from './mongo-connect';
export async function initDB() {
  if (Environment.database.connector === 'Mongodb') {
    await connectDB();
  }
}
