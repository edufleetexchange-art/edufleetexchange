import express from 'express';
import { 
  getSalesStats, 
  getSubscriptionRequests, 
  updateRequestStatus,
  getAllLeads,
  updateLeadStatus,
  createSalesUser,
  createSalesListing,
  createSalesVendor
} from '../controllers/salesController.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// All sales routes are protected and require sales or admin role
router.use(authenticate);
router.use(requireRole(['sales', 'admin']));

router.get('/stats', getSalesStats);
router.get('/requests', getSubscriptionRequests);
router.put('/requests/:id', updateRequestStatus);

// Lead management (Marketing leads)
router.get('/leads', getAllLeads);
router.put('/leads/:id', updateLeadStatus);

// Account creation
router.post('/users', createSalesUser);

// Listing creation for institutes
router.post('/listings', createSalesListing);

// Vendor management
router.post('/vendors', createSalesVendor);

export default router;