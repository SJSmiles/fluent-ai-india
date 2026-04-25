import mongoose from 'mongoose';

let isConnected = false;

export async function connectDB() {
  const uri = process.env.DATABASE_URI;

  if (!uri) {
    throw new Error('❌ DATABASE_URI is missing in .env');
  }

  // ✅ prevent multiple connections
  if (isConnected) {
    return;
  }

  await mongoose.connect(uri, {
    dbName: process.env.DB_NAME, // optional but recommended
  });

  isConnected = true;

  console.log('✅ Mongo connected');
}