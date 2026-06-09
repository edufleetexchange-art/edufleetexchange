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

// Strict MIME allow-lists. We check BOTH the browser-supplied mime AND the
// file extension; the magic-byte check happens at the route layer after multer
// has the bytes in memory. Older filters used an unanchored regex so e.g.
// "exploit.jpg.exe" or "exploit.svg" matched — fixed by requiring exact match.
const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const IMAGE_EXT = new Set(['jpeg', 'jpg', 'png', 'webp', 'gif']);
const DOCUMENT_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);
const DOCUMENT_EXT = new Set(['pdf', 'doc', 'docx', 'txt']);

function extOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

// File filter for image uploads (strict — exact mime + exact extension).
export const imageFileFilter = (
  _req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (IMAGE_MIME.has(file.mimetype) && IMAGE_EXT.has(extOf(file.originalname))) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, png, webp, gif)'));
  }
};

// File filter for document uploads (strict — exact mime + exact extension).
export const documentFileFilter = (
  _req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (DOCUMENT_MIME.has(file.mimetype) && DOCUMENT_EXT.has(extOf(file.originalname))) {
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
