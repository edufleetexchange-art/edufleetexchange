/**
 * Upload Middleware
 * Configured multer instances for file uploads
 */

import multer from 'multer';
import { imageFileFilter, documentFileFilter, multerConfig } from '../config/multer.js';

// Separate multer instances per file kind so the documents field doesn't
// inherit the image-only filter (the previous combined instance silently
// accepted whatever the image filter let through under the 'documents' name).
const imageUpload = multer({ ...multerConfig, fileFilter: imageFileFilter });
const documentUpload = multer({ ...multerConfig, fileFilter: documentFileFilter });

export const upload = imageUpload; // back-compat default

export const uploadMultiple = imageUpload.array('images', multerConfig.limits.files);
export const uploadSingle = imageUpload.single('image');

// Mixed-field uploads: images stream through the image filter; documents
// through the document filter — multer applies the filter per-instance.
// For the docs field we route through a documentUpload.fields with a single
// dedicated field; if you need both image+document fields in one form,
// split into two endpoints to keep the security boundary clean.
export const uploadFields = imageUpload.fields([
  { name: 'images', maxCount: multerConfig.limits.files },
  { name: 'thumbnail', maxCount: 1 },
]);

export const uploadDocuments = documentUpload.array('documents', 5);
export const uploadSingleDocument = documentUpload.single('document');

export { upload as multerUpload };
export default upload;
