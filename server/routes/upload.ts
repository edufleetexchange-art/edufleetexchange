import express, { Request, Response } from 'express';
import { put } from '@vercel/blob';
import { uploadMultiple, uploadSingle } from '../middleware/upload.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Protect all upload routes
router.use(authenticate);

// Helper to convert buffer to base64
const toBase64 = (buffer: Buffer, mimetype: string) => {
  return `data:${mimetype};base64,${buffer.toString('base64')}`;
};

/**
 * Store an uploaded file and return a URL for it.
 *
 * Deployed (BLOB_READ_WRITE_TOKEN set): upload to Vercel Blob and return its
 * public CDN URL — keeps images out of MongoDB documents (16MB doc limit) and
 * out of API responses (Vercel's ~4.5MB response cap). Files are namespaced
 * per environment via BLOB_PREFIX (dev/stage/prod) since all environments
 * share one store.
 *
 * Local dev without a token: fall back to the old base64 data-URI so uploads
 * keep working with zero configuration.
 */
const storeFile = async (file: Express.Multer.File): Promise<string> => {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return toBase64(file.buffer, file.mimetype);
  }
  const prefix = process.env.BLOB_PREFIX || 'local';
  const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
  const blob = await put(`${prefix}/${safeName}`, file.buffer, {
    access: 'public',
    contentType: file.mimetype,
    addRandomSuffix: true,
  });
  return blob.url;
};

// Upload single file
router.post('/single', uploadSingle, async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
        code: 'NO_FILE',
      });
    }

    const fileUrl = await storeFile(req.file);

    res.status(200).json({
      success: true,
      data: {
        url: fileUrl,
        filename: req.file.filename || req.file.originalname, // memory storage doesn't set filename
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'File upload failed',
      code: 'UPLOAD_FAILED',
    });
  }
});

// Upload multiple files
router.post('/multiple', uploadMultiple, async (req: Request, res: Response) => {
  try {
    if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded',
        code: 'NO_FILES',
      });
    }

    const files = req.files as Express.Multer.File[];
    const fileData = await Promise.all(
      files.map(async file => ({
        url: await storeFile(file),
        filename: file.filename || file.originalname,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
      }))
    );

    // Return in format expected by apiClient.uploadFiles
    res.status(200).json({
      success: true,
      data: fileData,
      urls: fileData.map(f => f.url),
      count: fileData.length,
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'File upload failed',
      code: 'UPLOAD_FAILED',
    });
  }
});

export default router;
