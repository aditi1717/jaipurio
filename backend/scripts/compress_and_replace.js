import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const MONGO_URI = 'mongodb+srv://dodjagrati_db_user:food123@cluster0.nsukixa.mongodb.net/test';

const ARTIFACT_DIR = 'C:\\Users\\aditi\\.gemini\\antigravity-ide\\brain\\bf7608c8-1733-4f5c-879a-7094c2014214';
const SRC_PRODUCT_IMG = path.join(ARTIFACT_DIR, 'product_primary_image_1786971521536.jpg');
const SRC_MOBILE_BANNER = path.join(ARTIFACT_DIR, 'mobile_banner_image_1786971540803.jpg');
const SRC_DESKTOP_BANNER = path.join(ARTIFACT_DIR, 'desktop_banner_image_1786971560107.jpg');

async function getCompressedBase64(filePath, width, height, quality = 65) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }
    const buffer = await sharp(filePath)
        .resize(width, height, { fit: 'cover' })
        .jpeg({ quality })
        .toBuffer();
    return `data:image/jpeg;base64,${buffer.toString('base64')}`;
}

async function run() {
    try {
        console.log('Compressing generated AI assets to lightweight Base64 strings...');
        const productBase64 = await getCompressedBase64(SRC_PRODUCT_IMG, 320, 320, 60);
        const mobileBannerBase64 = await getCompressedBase64(SRC_MOBILE_BANNER, 450, 800, 65);
        const desktopBannerBase64 = await getCompressedBase64(SRC_DESKTOP_BANNER, 900, 506, 65);

        console.log(`Product Base64 string length: ${productBase64.length} chars (~${(productBase64.length / 1024).toFixed(1)} KB)`);
        console.log(`Mobile Banner Base64 string length: ${mobileBannerBase64.length} chars (~${(mobileBannerBase64.length / 1024).toFixed(1)} KB)`);
        console.log(`Desktop Banner Base64 string length: ${desktopBannerBase64.length} chars (~${(desktopBannerBase64.length / 1024).toFixed(1)} KB)`);

        console.log('\nConnecting to MongoDB:', MONGO_URI);
        await mongoose.connect(MONGO_URI);
        console.log('Connected to Database:', mongoose.connection.name);

        const db = mongoose.connection.db;

        // 1. Update Products
        console.log('\n--- Updating Products ---');
        const prodRes = await db.collection('products').updateMany(
            {},
            {
                $set: {
                    image: productBase64,
                    images: [productBase64]
                }
            }
        );
        console.log(`Updated ${prodRes.modifiedCount} products.`);

        // 2. Update Banners
        console.log('\n--- Updating Banners ---');
        const banners = await db.collection('banners').find({}).toArray();
        let bannerCount = 0;
        for (const banner of banners) {
            const updates = {};
            if (banner.slides && banner.slides.length > 0) {
                updates.slides = banner.slides.map(slide => ({
                    ...slide,
                    imageUrl: desktopBannerBase64,
                    mobileImageUrl: mobileBannerBase64
                }));
            }
            if (banner.content) {
                updates.content = {
                    ...banner.content,
                    imageUrl: desktopBannerBase64,
                    backgroundImageUrl: desktopBannerBase64,
                    mobileBackgroundImageUrl: mobileBannerBase64
                };
            }
            if (Object.keys(updates).length > 0) {
                await db.collection('banners').updateOne({ _id: banner._id }, { $set: updates });
                bannerCount++;
            }
        }
        console.log(`Updated ${bannerCount} banners.`);

        // 3. Update Categories
        console.log('\n--- Updating Categories ---');
        const categories = await db.collection('categories').find({}).toArray();
        let catCount = 0;
        for (const cat of categories) {
            const updates = { icon: productBase64 };
            if (cat.smallBanners && cat.smallBanners.length > 0) {
                updates.smallBanners = cat.smallBanners.map(b => ({ ...b, image: desktopBannerBase64 }));
            }
            if (cat.secondaryBanners && cat.secondaryBanners.length > 0) {
                updates.secondaryBanners = cat.secondaryBanners.map(b => ({ ...b, image: desktopBannerBase64 }));
            }
            await db.collection('categories').updateOne({ _id: cat._id }, { $set: updates });
            catCount++;
        }
        console.log(`Updated ${catCount} categories.`);

        // 4. Update SubCategories
        console.log('\n--- Updating SubCategories ---');
        const subRes = await db.collection('subcategories').updateMany(
            {},
            { $set: { image: productBase64 } }
        );
        console.log(`Updated ${subRes.modifiedCount} subcategories.`);

        console.log('\n✅ Successfully updated MongoDB with lightweight production-ready Base64 images!');

        await mongoose.disconnect();
    } catch (err) {
        console.error('Error during update:', err);
    }
}

run();
