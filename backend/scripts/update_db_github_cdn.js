import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://dodjagrati_db_user:food123@cluster0.nsukixa.mongodb.net/test';

// Production GitHub CDN URLs
const PRODUCT_URL = 'https://raw.githubusercontent.com/aditi1717/jaipurio/main/frontend/public/images/generated_product.jpg';
const MOBILE_BANNER_URL = 'https://raw.githubusercontent.com/aditi1717/jaipurio/main/frontend/public/images/generated_banner_mobile.jpg';
const DESKTOP_BANNER_URL = 'https://raw.githubusercontent.com/aditi1717/jaipurio/main/frontend/public/images/generated_banner_desktop.jpg';

async function updateDatabaseCDN() {
    try {
        console.log('Connecting to MongoDB:', MONGO_URI);
        await mongoose.connect(MONGO_URI);
        console.log('Connected to Database:', mongoose.connection.name);

        const db = mongoose.connection.db;

        // 1. Update Products Collection
        console.log('\n--- Updating Products Collection ---');
        const productRes = await db.collection('products').updateMany(
            {},
            {
                $set: {
                    image: PRODUCT_URL,
                    images: [PRODUCT_URL]
                }
            }
        );
        console.log(`Updated ${productRes.modifiedCount} products primary and gallery image URLs.`);

        // Also update description images in products where description exists
        const prodDescRes = await db.collection('products').updateMany(
            { 'description.image': { $exists: true, $ne: null } },
            { $set: { 'description.$[elem].image': PRODUCT_URL } },
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
                    imageUrl: DESKTOP_BANNER_URL,
                    mobileImageUrl: MOBILE_BANNER_URL
                }));
                updates.slides = updatedSlides;
            }

            if (banner.content) {
                const updatedContent = {
                    ...banner.content,
                    imageUrl: DESKTOP_BANNER_URL,
                    backgroundImageUrl: DESKTOP_BANNER_URL,
                    mobileBackgroundImageUrl: MOBILE_BANNER_URL
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
            const updates = { icon: PRODUCT_URL };

            if (cat.smallBanners && cat.smallBanners.length > 0) {
                updates.smallBanners = cat.smallBanners.map(b => ({ ...b, image: DESKTOP_BANNER_URL }));
            }
            if (cat.secondaryBanners && cat.secondaryBanners.length > 0) {
                updates.secondaryBanners = cat.secondaryBanners.map(b => ({ ...b, image: DESKTOP_BANNER_URL }));
            }

            await db.collection('categories').updateOne({ _id: cat._id }, { $set: updates });
            updatedCategoriesCount++;
        }
        console.log(`Updated ${updatedCategoriesCount} categories with icon and banner URLs.`);

        // 4. Update SubCategories Collection
        console.log('\n--- Updating SubCategories Collection ---');
        const subcatRes = await db.collection('subcategories').updateMany(
            {},
            { $set: { image: PRODUCT_URL } }
        );
        console.log(`Updated ${subcatRes.modifiedCount} subcategory images.`);

        // 5. Update Offers Collection
        console.log('\n--- Updating Offers Collection ---');
        const offerRes = await db.collection('offers').updateMany(
            { bannerImage: { $exists: true } },
            { $set: { bannerImage: DESKTOP_BANNER_URL } }
        );
        console.log(`Updated ${offerRes.modifiedCount} offer banner images.`);

        // 6. Update Brands Collection (if any)
        console.log('\n--- Updating Brands Collection ---');
        const brandRes = await db.collection('brands').updateMany(
            { logo: { $exists: true } },
            { $set: { logo: PRODUCT_URL } }
        );
        console.log(`Updated ${brandRes.modifiedCount} brand logo images.`);

        console.log('\n✅ All MongoDB image URLs successfully updated to production CDN URLs!');

        await mongoose.disconnect();
    } catch (error) {
        console.error('Error updating database:', error);
    }
}

updateDatabaseCDN();
