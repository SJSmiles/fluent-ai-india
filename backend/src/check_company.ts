import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

async function checkCompany() {
    try {
        const uri = process.env.DATABASE_URI;
        await mongoose.connect(uri!);
        const db = mongoose.connection.db;
        const collection = db.collection('Company');
        
        const company = await collection.findOne({ _id: new mongoose.Types.ObjectId("69ec9447b2a2987f6994e29e") });
        console.log('🏢 Company from DB:', JSON.stringify(company, null, 2));

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

checkCompany();
