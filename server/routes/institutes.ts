import express from 'express';
import { listInstitutes, getInstitute } from '../controllers/instituteController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// The institute directory exposes contact details (email, phone, address).
// Require auth before enumerating it.
router.get('/', authenticate, listInstitutes);
router.get('/:id', authenticate, getInstitute);
export default router;
