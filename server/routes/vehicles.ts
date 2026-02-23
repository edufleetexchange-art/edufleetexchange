import express from 'express';
import {
  getVehicles,
  getVehicle,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  getPriorityListings,
  getRecentListings,
  getMyListings,
} from '../controllers/vehicleController.js';
import { authenticate, authorize, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Public routes - order matters! Specific routes before dynamic :id
router.get('/priority', getPriorityListings);
router.get('/recent', getRecentListings);

// Protected routes - must be before :id route
router.get('/my/listings', authenticate, authorize('institute', 'sales', 'admin'), getMyListings);

// General routes
router.get('/', optionalAuth, getVehicles);
router.get('/:id', optionalAuth, getVehicle);

// Protected CRUD operations
router.post('/', authenticate, authorize('institute', 'sales', 'admin'), createVehicle);
router.put('/:id', authenticate, authorize('institute', 'sales', 'admin'), updateVehicle);
router.delete('/:id', authenticate, authorize('institute', 'sales', 'admin'), deleteVehicle);

export default router;