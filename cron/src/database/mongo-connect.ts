import mongoose from 'mongoose'
import dotenv from 'dotenv';

// Load env variables
dotenv.config();

let database: mongoose.Connection

export const connectDB = async () => {
  const uri: any = process.env.MONGO_URL
  if (database) {
    return
  }

  mongoose.connection.on('connected', () => {
    console.log({ actor: 'MongoDB' }, 'Connected to database')
  })

  mongoose.connection.on('disconnected', () => {
    console.log({ actor: 'MongoDB' }, 'Error connecting to database')
  })

  await mongoose.connect(uri, {
    autoIndex: false,
    maxPoolSize: 10, 
    serverSelectionTimeoutMS: 5000, 
    socketTimeoutMS: 45000,
    family: 4
  })

  database = mongoose.connection
  console.log({ DB: database?.name }, 'Database Name')

}

export const disconnectDB = () => {
  if (!database) {
    return
  }
  mongoose.disconnect()
}

export const getCollection = async (collectionName: string) => {  
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB is not connected');
  
    return await db.collection(collectionName);
  };
  