import express from 'express';
import { listInstitutes, getInstitute } from '../controllers/instituteController.js';

const router = express.Router();
router.get('/', listInstitutes);
router.get('/:id', getInstitute);
export default router;
