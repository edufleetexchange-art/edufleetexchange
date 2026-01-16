import express from 'express';
import {
  getDashboardStats,
  getPendingVehicles,
  approveVehicle,
  togglePriority,
  getAllUsers,
  updateUserStatus,
} from '../controllers/adminController.js';
import { approveSupplierStatus } from '../controllers/supplierController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// All routes require admin authentication
router.use(authenticate);
router.use(authorize('admin'));

router.get('/stats', getDashboardStats);
router.get('/pending', getPendingVehicles);
router.put('/approve/:id', approveVehicle);
router.put('/priority/:id', togglePriority);
router.get('/users', getAllUsers);
router.put('/users/:id/status', updateUserStatus);
router.put('/suppliers/:id/approve', approveSupplierStatus);

export default router;
