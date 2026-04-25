import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

async function checkUser() {
    try {
        const uri = process.env.DATABASE_URI;
        await mongoose.connect(uri!);
        const db = mongoose.connection.db;
        const collection = db.collection('User');
        
        const user = await collection.findOne({ _id: new mongoose.Types.ObjectId("69ec9448b2a2987f6994e2a2") });
        console.log('👤 User from DB:', JSON.stringify(user, null, 2));

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

checkUser();
