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
router.get('/my/listings', protect, getMySuppliers);

// Public dynamic route
router.get('/:id', getSupplierById);

// Protected CRUD operations
router.post('/', protect, createSupplier);
router.put('/:id/toggle-verification', protect, restrictTo('admin'), toggleVerification);
router.put('/:id', protect, updateSupplier);
router.delete('/:id', protect, deleteSupplier);

export default router;