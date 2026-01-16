/**
 * Upload Middleware
 * Configured multer instances for file uploads
 */

import multer from 'multer';
import { storage, imageFileFilter, multerConfig } from '../config/multer.js';

// Multer upload instance for images
export const upload = multer({
  ...multerConfig,
  fileFilter: imageFileFilter,
});

// For multiple image files
export const uploadMultiple = upload.array('images', multerConfig.limits.files);

// For single image file
export const uploadSingle = upload.single('image');

// For mixed form fields with images
export const uploadFields = upload.fields([
  { name: 'images', maxCount: multerConfig.limits.files },
  { name: 'thumbnail', maxCount: 1 },
  { name: 'documents', maxCount: 5 },
]);

// Export for custom use cases
export { upload as multerUpload };
export default upload;
