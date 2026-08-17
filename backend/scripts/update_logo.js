import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

const MONGO_URI = 'mongodb+srv://dodjagrati_db_user:food123@cluster0.nsukixa.mongodb.net/test';

const SRC_LOGO = 'c:\\Users\\aditi\\OneDrive\\Desktop\\company project\\jaipurio\\frontend\\src\\assets\\jaipurio-logo.jpeg';
const DEST_LOGO = 'c:\\Users\\aditi\\OneDrive\\Desktop\\company project\\jaipurio\\frontend\\public\\images\\jaipurio-logo.jpeg';

const LOGO_CDN_URL = 'https://raw.githubusercontent.com/aditi1717/jaipurio/main/frontend/public/images/jaipurio-logo.jpeg';

async function updateLogo() {
    try {
        console.log('Copying jaipurio-logo.jpeg to frontend/public/images...');
        fs.copyFileSync(SRC_LOGO, DEST_LOGO);
        console.log('Copied successfully!');

        console.log('\nConnecting to MongoDB:', MONGO_URI);
        await mongoose.connect(MONGO_URI);
        console.log('Connected to Database:', mongoose.connection.name);

        const db = mongoose.connection.db;

        const res = await db.collection('settings').updateMany(
            {},
            { $set: { logoUrl: LOGO_CDN_URL } }
        );
        console.log(`Updated ${res.modifiedCount} settings document(s) with logoUrl = ${LOGO_CDN_URL}`);

        await mongoose.disconnect();
    } catch (err) {
        console.error('Error updating logo:', err);
    }
}

updateLogo();
