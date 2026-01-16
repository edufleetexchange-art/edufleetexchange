/**
 * Multer Configuration
 * Handles file upload settings and validation
 */

import multer from 'multer';
import * as path from 'path';
import { ENV } from './environment.js';

// Storage configuration - using memory storage for flexibility
export const storage = multer.memoryStorage();

// Alternative: Disk storage (uncomment if you prefer disk storage)
// export const diskStorage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, path.join(__dirname, '../../uploads'));
//   },
//   filename: (req, file, cb) => {
//     const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
//     cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
//   }
// });

// File filter for image validation
export const imageFileFilter = (
  req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedTypes = /jpeg|jpg|png|webp|gif/;
  const extension = file.originalname.split('.').pop()?.toLowerCase() || '';
  const extname = allowedTypes.test(extension);
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, webp, gif)'));
  }
};

// File filter for documents
export const documentFileFilter = (
  req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedTypes = /pdf|doc|docx|txt/;
  const extension = file.originalname.split('.').pop()?.toLowerCase() || '';
  const extname = allowedTypes.test(extension);

  if (extname) {
    cb(null, true);
  } else {
    cb(new Error('Only document files are allowed (pdf, doc, docx, txt)'));
  }
};

// Multer limits configuration
export const uploadLimits = {
  fileSize: ENV.MAX_FILE_SIZE, // from environment config
  files: ENV.MAX_FILES, // maximum number of files
};

// Export configured multer instances
export const multerConfig = {
  storage,
  limits: uploadLimits,
};

export default multerConfig;
