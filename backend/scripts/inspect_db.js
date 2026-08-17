import mongoose from 'mongoose';

async function inspectDB() {
    try {
        await mongoose.connect('mongodb+srv://dodjagrati_db_user:food123@cluster0.nsukixa.mongodb.net/test');
        console.log('Connected to MongoDB DB:', mongoose.connection.name);
        const db = mongoose.connection.db;

        const prodCount = await db.collection('products').countDocuments();
        const bannerCount = await db.collection('banners').countDocuments();
        const catCount = await db.collection('categories').countDocuments();
        const subcatCount = await db.collection('subcategories').countDocuments();
        const offerCount = await db.collection('offers').countDocuments();

        console.log(`Counts -> Products: ${prodCount}, Banners: ${bannerCount}, Categories: ${catCount}, SubCategories: ${subcatCount}, Offers: ${offerCount}`);

        const prod = await db.collection('products').findOne({});
        console.log('--- Sample Product ---');
        console.log('image:', prod?.image);
        console.log('images:', prod?.images);

        const banner = await db.collection('banners').findOne({});
        console.log('\n--- Sample Banner ---');
        console.log(JSON.stringify(banner, null, 2));

        const cat = await db.collection('categories').findOne({});
        console.log('\n--- Sample Category ---');
        console.log(cat);

        const subcat = await db.collection('subcategories').findOne({});
        console.log('\n--- Sample SubCategory ---');
        console.log(subcat);

        const offer = await db.collection('offers').findOne({});
        console.log('\n--- Sample Offer ---');
        console.log(offer);

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

inspectDB();
