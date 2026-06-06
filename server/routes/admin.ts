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
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getSettings,
  updateSetting,
  adminListConsultants,
  adminListPlacements,
} from '../controllers/adminController.js';
import { approveSupplierStatus } from '../controllers/supplierController.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import {
  summary as metricsSummary,
  signups as metricsSignups,
  approvalFunnel as metricsApprovalFunnel,
  activeUsers as metricsActiveUsers,
} from '../controllers/metricsController.js';

const router = express.Router();

// All routes require admin authentication
router.use(authenticate);

// Specific permissions for marketing and sales
router.get('/users', requireRole(['admin', 'marketing', 'sales']), getAllUsers);
router.post('/users', requireRole(['admin', 'sales']), createUser);
router.put('/users/:id/status', requireRole(['admin', 'sales']), updateUserStatus);

// Admin only routes
router.use(requireRole('admin'));

router.get('/stats', getDashboardStats);
router.get('/pending', getPendingVehicles);
router.put('/approve/:id', approveVehicle);
router.put('/priority/:id', togglePriority);
router.get('/audit-logs', getAuditLogs);
router.delete('/users/:id', deleteUser);
router.put('/suppliers/:id/approve', approveSupplierStatus);

// Categories
router.get('/categories', getCategories);
router.post('/categories', createCategory);
router.put('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);

// System Settings
router.get('/settings', getSettings);
router.put('/settings/:key', updateSetting);

// Metrics endpoints (admin-only, authenticate already applied above via router.use)
router.get('/metrics/summary', metricsSummary);
router.get('/metrics/signups', metricsSignups);
router.get('/metrics/approval-funnel', metricsApprovalFunnel);
router.get('/metrics/active-users', metricsActiveUsers);

// Consultant + placement admin views
router.get('/consultants', requireRole(['admin']), adminListConsultants);
router.get('/placements', requireRole(['admin']), adminListPlacements);

export default router;