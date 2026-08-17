import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ARTIFACT_DIR = 'C:\\Users\\aditi\\.gemini\\antigravity-ide\\brain\\bf7608c8-1733-4f5c-879a-7094c2014214';
const SRC_PRODUCT_IMG = path.join(ARTIFACT_DIR, 'product_primary_image_1786971521536.jpg');
const SRC_MOBILE_BANNER = path.join(ARTIFACT_DIR, 'mobile_banner_image_1786971540803.jpg');
const SRC_DESKTOP_BANNER = path.join(ARTIFACT_DIR, 'desktop_banner_image_1786971560107.jpg');

const FRONTEND_IMAGES_DIR = path.join(__dirname, '..', 'frontend', 'public', 'images');

fs.mkdirSync(FRONTEND_IMAGES_DIR, { recursive: true });

fs.copyFileSync(SRC_PRODUCT_IMG, path.join(FRONTEND_IMAGES_DIR, 'generated_product.jpg'));
fs.copyFileSync(SRC_MOBILE_BANNER, path.join(FRONTEND_IMAGES_DIR, 'generated_banner_mobile.jpg'));
fs.copyFileSync(SRC_DESKTOP_BANNER, path.join(FRONTEND_IMAGES_DIR, 'generated_banner_desktop.jpg'));

console.log('Successfully copied assets to frontend/public/images:');
console.log(' - frontend/public/images/generated_product.jpg');
console.log(' - frontend/public/images/generated_banner_mobile.jpg');
console.log(' - frontend/public/images/generated_banner_desktop.jpg');
