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
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/', getAllSuppliers);

// Protected specific routes MUST come before :id
router.get('/stats', authenticate, requireRole('admin'), getSupplierStats);
router.get('/my/listings', authenticate, requireRole(['admin', 'vendor']), getMySuppliers);

// Public dynamic route
router.get('/:id', getSupplierById);

// Protected CRUD operations
router.post('/', authenticate, requireRole(['admin', 'vendor', 'sales']), createSupplier);
router.put('/:id/toggle-verification', authenticate, requireRole('admin'), toggleVerification);
router.put('/:id', authenticate, requireRole(['admin', 'vendor', 'sales']), updateSupplier);
router.delete('/:id', authenticate, requireRole(['admin', 'vendor', 'sales']), deleteSupplier);

export default router;