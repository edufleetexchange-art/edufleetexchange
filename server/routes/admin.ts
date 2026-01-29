import express from 'express';
import {
  getDashboardStats,
  getPendingVehicles,
  approveVehicle,
  togglePriority,
  getAllUsers,
  updateUserStatus,
  createUser,
  deleteUser,
  getAuditLogs,
} from '../controllers/adminController.js';
import { approveSupplierStatus } from '../controllers/supplierController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// All routes require admin authentication
router.use(authenticate);

// Specific permissions for marketing
router.get('/users', authorize('admin', 'marketing'), getAllUsers);
router.post('/users', authorize('admin', 'marketing'), createUser);
router.put('/users/:id/status', authorize('admin', 'marketing'), updateUserStatus);

// Admin only routes
router.use(authorize('admin'));

router.get('/stats', getDashboardStats);
router.get('/pending', getPendingVehicles);
router.put('/approve/:id', approveVehicle);
router.put('/priority/:id', togglePriority);
router.get('/audit-logs', getAuditLogs);
router.delete('/users/:id', deleteUser);
router.put('/suppliers/:id/approve', approveSupplierStatus);

export default router;