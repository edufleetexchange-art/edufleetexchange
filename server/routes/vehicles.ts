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
import { authenticate, optionalAuthenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Public routes - order matters! Specific routes before dynamic :id
router.get('/priority', getPriorityListings);
router.get('/recent', getRecentListings);

// Protected routes - must be before :id route
router.get('/my/listings', authenticate, requireRole(['institute', 'sales', 'admin']), getMyListings);

// General routes — optionalAuthenticate so logged-in buyers see seller contact
// while anonymous callers get it masked (see stripSellerPIIForAnon).
router.get('/', optionalAuthenticate, getVehicles);
router.get('/:id', optionalAuthenticate, getVehicle);

// Protected CRUD operations
router.post('/', authenticate, requireRole(['institute', 'sales', 'admin']), createVehicle);
router.put('/:id', authenticate, requireRole(['institute', 'sales', 'admin']), updateVehicle);
router.delete('/:id', authenticate, requireRole(['institute', 'sales', 'admin']), deleteVehicle);

export default router;