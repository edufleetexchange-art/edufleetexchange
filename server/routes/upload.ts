import express, { Request, Response } from 'express';
import { uploadMultiple, uploadSingle } from '../middleware/upload.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Protect all upload routes
router.use(protect);

// Helper to convert buffer to base64
const toBase64 = (buffer: Buffer, mimetype: string) => {
  return `data:${mimetype};base64,${buffer.toString('base64')}`;
};

// Upload single file
router.post('/single', uploadSingle, (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
        code: 'NO_FILE',
      });
    }

    const fileUrl = toBase64(req.file.buffer, req.file.mimetype);

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
router.post('/multiple', uploadMultiple, (req: Request, res: Response) => {
  try {
    if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded',
        code: 'NO_FILES',
      });
    }

    const files = req.files as Express.Multer.File[];
    const fileData = files.map(file => ({
      url: toBase64(file.buffer, file.mimetype),
      filename: file.filename || file.originalname,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
    }));

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
