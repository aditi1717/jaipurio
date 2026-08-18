import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import Category from '../models/Category.js';
import SubCategory from '../models/SubCategory.js';
import Product from '../models/Product.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://dodjagrati_db_user:food123@cluster0.nsukixa.mongodb.net/';

const categoryData = [
    {
        id: 1,
        name: "Home & Living",
        icon: "home",
        subCategories: [
            "Spirituality & Religion",
            "Religious Home & Decor",
            "Home Decor",
            "Religious Statuary Idols",
            "Home & Living",
            "Handicrafts",
            "Painting"
        ]
    },
    {
        id: 2,
        name: "Clothing & Apparel",
        icon: "checkroom",
        subCategories: [
            "Sarees",
            "Blazers",
            "Jodhpuri Breeches (Riding Pants)",
            "Real Silver Saree",
            "Clothing",
            "Men's Clothing",
            "Kurtas",
            "Rajputi Poshak",
            "Women's Clothing",
            "Suits and Jackets",
            "Real Silver Poshak",
            "Jodhpuri Achkans",
            "Jodhpuri Waistcoat Sets",
            "Jodhpuri Bandhgala Suits"
        ]
    },
    {
        id: 3,
        name: "Home, Garden & Kitchen",
        icon: "kitchen",
        subCategories: [
            "Top Handle Bags",
            "Sculpture",
            "Crossbody Bags",
            "Painting",
            "Shoulder Bags",
            "Handbags",
            "Art & Collectibles",
            "Clutches & Evening Bags",
            "Bags & Purses",
            "Potli Bags"
        ]
    },
    {
        id: 4,
        name: "Accessories",
        icon: "watch",
        subCategories: [
            "Jewellery",
            "Bangles",
            "Moissanite Stones",
            "Bracelets",
            "Rings",
            "Necklaces",
            "Gemstone",
            "Earrings"
        ]
    },
    {
        id: 5,
        name: "Jewellery",
        icon: "diamond",
        subCategories: [
            "Top Handle Bags",
            "Crossbelt",
            "Lapel Pins",
            "Pocket Squares",
            "Painting"
        ]
    }
];

// Sample realistic image pools per main category
const imagePools = {
    "Home & Living": [
        "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1582582621959-48d273528920?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1544816155-12df9643f363?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?q=80&w=600&auto=format&fit=crop"
    ],
    "Clothing & Apparel": [
        "https://images.unsplash.com/photo-1610030469983-98e550d6193c?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?q=80&w=600&auto=format&fit=crop"
    ],
    "Home, Garden & Kitchen": [
        "https://images.unsplash.com/photo-1584917865442-de89df76afd3?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?q=80&w=600&auto=format&fit=crop"
    ],
    "Accessories": [
        "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1605100804763-247f67b3557e?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1603561591411-07134e71a2a9?q=80&w=600&auto=format&fit=crop"
    ],
    "Jewellery": [
        "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1602751584552-8ba73aad10e1?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1599643477877-530eb83abc8e?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1611591475777-233cd73be3df?q=80&w=600&auto=format&fit=crop"
    ]
};

async function seedDatabase() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB database:', mongoose.connection.name);

        console.log('\n--- Step 1: Clearing existing collections ---');
        const prodDel = await Product.deleteMany({});
        console.log(`Deleted ${prodDel.deletedCount} products.`);

        const subDel = await SubCategory.deleteMany({});
        console.log(`Deleted ${subDel.deletedCount} subcategories.`);

        const catDel = await Category.deleteMany({});
        console.log(`Deleted ${catDel.deletedCount} categories.`);

        console.log('\n--- Step 2: Creating Categories, Subcategories, and Linked Products ---');
        let productIdCounter = 1001;
        let totalCategories = 0;
        let totalSubcategories = 0;
        let totalProducts = 0;

        for (const catInfo of categoryData) {
            // Create Category
            const categoryDoc = await Category.create({
                id: catInfo.id,
                name: catInfo.name,
                icon: catInfo.icon,
                active: true,
                b2bEnabled: false
            });
            totalCategories++;
            console.log(`\nCreated Category [ID: ${categoryDoc.id}]: ${categoryDoc.name}`);

            const pool = imagePools[catInfo.name] || imagePools["Home & Living"];

            for (let i = 0; i < catInfo.subCategories.length; i++) {
                const subCatName = catInfo.subCategories[i];
                const subCatImg = pool[i % pool.length];

                // Create SubCategory
                const subCategoryDoc = await SubCategory.create({
                    name: subCatName,
                    category: categoryDoc._id,
                    image: subCatImg,
                    isActive: true
                });
                totalSubcategories++;

                // Create 2 Linked Products for this SubCategory
                for (let p = 1; p <= 2; p++) {
                    const prodId = productIdCounter++;
                    const price = Math.floor(1000 + Math.random() * 8000);
                    const origPrice = Math.floor(price * 1.4);
                    const discountPct = Math.round(((origPrice - price) / origPrice) * 100);
                    const prodImg = pool[(i + p) % pool.length];

                    const productName = p === 1 
                        ? `Royal Jaipur ${subCatName} - Premium Edition`
                        : `Handcrafted ${subCatName} - Heritage Collection`;

                    await Product.create({
                        id: prodId,
                        name: productName,
                        brand: "Jaipurio Royal",
                        price: price,
                        originalPrice: origPrice,
                        discount: `${discountPct}% off`,
                        rating: +(4.3 + Math.random() * 0.6).toFixed(1),
                        ratingCount: Math.floor(20 + Math.random() * 150),
                        image: prodImg,
                        images: [prodImg, pool[(i + p + 1) % pool.length]],
                        category: categoryDoc.name,
                        categoryId: categoryDoc.id,
                        subCategories: [subCategoryDoc._id],
                        categoryPath: [String(categoryDoc.id), String(subCategoryDoc._id)],
                        tags: [categoryDoc.name, subCatName, "Jaipurio"],
                        description: [{
                            heading: "Product Overview",
                            points: [
                                "Authentic Rajasthani Craftsmanship",
                                "Premium quality materials & finish",
                                "Perfect for home, gifting, and occasions"
                            ]
                        }],
                        deliveryDays: 4,
                        stock: 50,
                        maxOrderQuantity: 5,
                        b2bEnabled: false
                    });
                    totalProducts++;
                }
                console.log(`  └─ Created SubCategory: "${subCatName}" with 2 linked products.`);
            }
        }

        console.log('\n==================================================');
        console.log('SUCCESS! Database seeded successfully!');
        console.log(`Total Categories Created: ${totalCategories}`);
        console.log(`Total SubCategories Created: ${totalSubcategories}`);
        console.log(`Total Products Created: ${totalProducts}`);
        console.log('==================================================\n');

        await mongoose.disconnect();
        console.log('Disconnected from MongoDB.');
        process.exit(0);
    } catch (err) {
        console.error('Error seeding database:', err);
        process.exit(1);
    }
}

seedDatabase();
