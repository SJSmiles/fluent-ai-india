import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

async function fixUser() {
    try {
        const uri = process.env.DATABASE_URI;
        await mongoose.connect(uri!);
        const db = mongoose.connection.db;
        const collection = db.collection('User');
        
        console.log('Restoring email for user anuj...');
        const result = await collection.updateOne(
            { _id: new mongoose.Types.ObjectId("69ec9448b2a2987f6994e2a2") },
            { $set: { email: "anuj@gotech.com" } }
        );
        console.log('Update result:', result);

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

fixUser();
