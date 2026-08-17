import mongoose from 'mongoose';
import cloudinary from 'cloudinary';
import './backend/models/Category.js';
import './backend/models/SubCategory.js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), 'backend', '.env') });

const Category = mongoose.model('Category');
const SubCategory = mongoose.model('SubCategory');

cloudinary.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

async function migrateImages() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Migrate SubCategories
        const subs = await SubCategory.find({ image: { $regex: /^data:image/ } });
        console.log(`Found ${subs.length} subcategories with base64 images`);

        for (const sub of subs) {
            console.log(`Uploading image for subcategory: ${sub.name}`);
            const result = await cloudinary.v2.uploader.upload(sub.image, {
                folder: 'jaipurio/subcategories'
            });
            sub.image = result.secure_url;
            await sub.save();
            console.log(`Updated ${sub.name} with Cloudinary URL`);
        }

        // Migrate Category Banners
        const cats = await Category.find({
            $or: [
                { 'smallBanners.image': { $regex: /^data:image/ } },
                { 'secondaryBanners.image': { $regex: /^data:image/ } }
            ]
        });
        console.log(`Found ${cats.length} categories with base64 banners`);

        for (const cat of cats) {
            console.log(`Processing banners for category: ${cat.name}`);
            let updated = false;

            if (cat.smallBanners && Array.isArray(cat.smallBanners)) {
                for (let i = 0; i < cat.smallBanners.length; i++) {
                    if (cat.smallBanners[i].image && cat.smallBanners[i].image.startsWith('data:image')) {
                        console.log(`Uploading small banner ${i} for ${cat.name}`);
                        const result = await cloudinary.v2.uploader.upload(cat.smallBanners[i].image, {
                            folder: 'jaipurio/banners/small'
                        });
                        cat.smallBanners[i].image = result.secure_url;
                        updated = true;
                    }
                }
            }

            if (cat.secondaryBanners && Array.isArray(cat.secondaryBanners)) {
                for (let i = 0; i < cat.secondaryBanners.length; i++) {
                    if (cat.secondaryBanners[i].image && cat.secondaryBanners[i].image.startsWith('data:image')) {
                        console.log(`Uploading secondary banner ${i} for ${cat.name}`);
                        const result = await cloudinary.v2.uploader.upload(cat.secondaryBanners[i].image, {
                            folder: 'jaipurio/banners/secondary'
                        });
                        cat.secondaryBanners[i].image = result.secure_url;
                        updated = true;
                    }
                }
            }

            if (updated) {
                cat.markModified('smallBanners');
                cat.markModified('secondaryBanners');
                await cat.save();
                console.log(`Updated banners for ${cat.name}`);
            }
        }

        console.log('Migration completed successfully');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrateImages();
