import { saveUploadedFile } from './localStorage.js';

/**
 * Uploads now go to local disk under backend/uploads/ and are served by nginx.
 * The Cloudinary account was disabled once its quota was exhausted, which broke
 * every upload path in the app.
 *
 * The name is kept so the eight existing call sites stay unchanged; the return
 * shape still mimics Cloudinary's ({ secure_url, public_id, ... }).
 */
export const uploadBufferToCloudinary = (input, options = {}) => saveUploadedFile(input, options);

export { saveUploadedFile };
