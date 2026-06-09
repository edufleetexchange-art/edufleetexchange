import express from 'express';
import { listVendors, getVendor } from '../controllers/vendorController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Vendor directory exposes business contact data — authenticated only.
router.get('/', authenticate, listVendors);
router.get('/:id', authenticate, getVendor);
export default router;
