import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

const MONGO_URI = 'mongodb+srv://dodjagrati_db_user:food123@cluster0.nsukixa.mongodb.net/test';

// Source generated images from artifact folder
const ARTIFACT_DIR = 'C:\\Users\\aditi\\.gemini\\antigravity-ide\\brain\\bf7608c8-1733-4f5c-879a-7094c2014214';
const SRC_PRODUCT_IMG = path.join(ARTIFACT_DIR, 'product_primary_image_1786971521536.jpg');
const SRC_MOBILE_BANNER = path.join(ARTIFACT_DIR, 'mobile_banner_image_1786971540803.jpg');
const SRC_DESKTOP_BANNER = path.join(ARTIFACT_DIR, 'desktop_banner_image_1786971560107.jpg');

function getBase64DataUrl(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }
    const buffer = fs.readFileSync(filePath);
    return `data:image/jpeg;base64,${buffer.toString('base64')}`;
}

async function updateDatabaseBase64() {
    try {
        console.log('Reading generated AI image files and encoding to Base64...');
        const productBase64 = getBase64DataUrl(SRC_PRODUCT_IMG);
        const mobileBannerBase64 = getBase64DataUrl(SRC_MOBILE_BANNER);
        const desktopBannerBase64 = getBase64DataUrl(SRC_DESKTOP_BANNER);

        console.log(`Product Base64 size: ${(productBase64.length / 1024).toFixed(2)} KB`);
        console.log(`Mobile Banner Base64 size: ${(mobileBannerBase64.length / 1024).toFixed(2)} KB`);
        console.log(`Desktop Banner Base64 size: ${(desktopBannerBase64.length / 1024).toFixed(2)} KB`);

        console.log('\nConnecting to MongoDB:', MONGO_URI);
        await mongoose.connect(MONGO_URI);
        console.log('Connected to Database:', mongoose.connection.name);

        const db = mongoose.connection.db;

        // 1. Update Products Collection
        console.log('\n--- Updating Products Collection ---');
        const productRes = await db.collection('products').updateMany(
            {},
            {
                $set: {
                    image: productBase64,
                    images: [productBase64]
                }
            }
        );
        console.log(`Updated ${productRes.modifiedCount} products primary and gallery image URLs.`);

        // Also update description images in products where description exists
        const prodDescRes = await db.collection('products').updateMany(
            { 'description.image': { $exists: true, $ne: null } },
            { $set: { 'description.$[elem].image': productBase64 } },
            { arrayFilters: [{ 'elem.image': { $exists: true, $ne: null } }] }
        );
        console.log(`Updated ${prodDescRes.modifiedCount} product description images.`);

        // 2. Update Banners Collection
        console.log('\n--- Updating Banners Collection ---');
        const banners = await db.collection('banners').find({}).toArray();
        let updatedBannersCount = 0;

        for (const banner of banners) {
            const updates = {};
            if (banner.slides && banner.slides.length > 0) {
                const updatedSlides = banner.slides.map(slide => ({
                    ...slide,
                    imageUrl: desktopBannerBase64,
                    mobileImageUrl: mobileBannerBase64
                }));
                updates.slides = updatedSlides;
            }

            if (banner.content) {
                const updatedContent = {
                    ...banner.content,
                    imageUrl: desktopBannerBase64,
                    backgroundImageUrl: desktopBannerBase64,
                    mobileBackgroundImageUrl: mobileBannerBase64
                };
                updates.content = updatedContent;
            }

            if (Object.keys(updates).length > 0) {
                await db.collection('banners').updateOne({ _id: banner._id }, { $set: updates });
                updatedBannersCount++;
            }
        }
        console.log(`Updated ${updatedBannersCount} banner documents with desktop and mobile banner URLs.`);

        // 3. Update Categories Collection
        console.log('\n--- Updating Categories Collection ---');
        const categories = await db.collection('categories').find({}).toArray();
        let updatedCategoriesCount = 0;

        for (const cat of categories) {
            const updates = { icon: productBase64 };

            if (cat.smallBanners && cat.smallBanners.length > 0) {
                updates.smallBanners = cat.smallBanners.map(b => ({ ...b, image: desktopBannerBase64 }));
            }
            if (cat.secondaryBanners && cat.secondaryBanners.length > 0) {
                updates.secondaryBanners = cat.secondaryBanners.map(b => ({ ...b, image: desktopBannerBase64 }));
            }

            await db.collection('categories').updateOne({ _id: cat._id }, { $set: updates });
            updatedCategoriesCount++;
        }
        console.log(`Updated ${updatedCategoriesCount} categories with icon and banner URLs.`);

        // 4. Update SubCategories Collection
        console.log('\n--- Updating SubCategories Collection ---');
        const subcatRes = await db.collection('subcategories').updateMany(
            {},
            { $set: { image: productBase64 } }
        );
        console.log(`Updated ${subcatRes.modifiedCount} subcategory images.`);

        // 5. Update Offers Collection
        console.log('\n--- Updating Offers Collection ---');
        const offerRes = await db.collection('offers').updateMany(
            { bannerImage: { $exists: true } },
            { $set: { bannerImage: desktopBannerBase64 } }
        );
        console.log(`Updated ${offerRes.modifiedCount} offer banner images.`);

        // 6. Update Brands Collection (if any)
        console.log('\n--- Updating Brands Collection ---');
        const brandRes = await db.collection('brands').updateMany(
            { logo: { $exists: true } },
            { $set: { logo: productBase64 } }
        );
        console.log(`Updated ${brandRes.modifiedCount} brand logo images.`);

        console.log('\n✅ All MongoDB image URLs replaced with production-ready Base64 data URLs!');

        await mongoose.disconnect();
    } catch (error) {
        console.error('Error updating database:', error);
    }
}

updateDatabaseBase64();
