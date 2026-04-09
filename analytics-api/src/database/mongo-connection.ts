import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.DATABASE_URI;

  if (!uri) {
    throw new Error('❌ DATABASE_URI is missing in .env');
  }

  await mongoose.connect(uri);

  console.log('✅ Mongo connected');
}