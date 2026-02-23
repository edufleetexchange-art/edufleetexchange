import express from 'express';
import {
  createSupplier,
  getAllSuppliers,
  getSupplierById,
  updateSupplier,
  deleteSupplier,
  getMySuppliers,
  getSupplierStats,
  toggleVerification,
} from '../controllers/supplierController.js';
import { protect, restrictTo, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/', optionalAuth, getAllSuppliers);

// Protected specific routes MUST come before :id
router.get('/stats', protect, restrictTo('admin'), getSupplierStats);
router.get('/my/listings', protect, restrictTo('admin', 'vendor'), getMySuppliers);

// Public dynamic route
router.get('/:id', getSupplierById);

// Protected CRUD operations
router.post('/', protect, restrictTo('admin', 'vendor', 'sales'), createSupplier);
router.put('/:id/toggle-verification', protect, restrictTo('admin'), toggleVerification);
router.put('/:id', protect, restrictTo('admin', 'vendor', 'sales'), updateSupplier);
router.delete('/:id', protect, restrictTo('admin', 'vendor', 'sales'), deleteSupplier);

export default router;