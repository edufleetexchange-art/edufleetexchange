import express from 'express';
import { listVendors, getVendor } from '../controllers/vendorController.js';

const router = express.Router();
router.get('/', listVendors);
router.get('/:id', getVendor);
export default router;
