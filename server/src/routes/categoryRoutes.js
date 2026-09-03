import express from 'express';
import {
  createCategory,
  getCategories,
  getCategoryById,
  assignAthleteToCategory,
  removeAthleteFromCategory,
  getPodium,
  deleteCategory,
} from '../controllers/categoryController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = express.Router();

router
  .route('/')
  .post(authenticate, requireRole('ADMIN'), createCategory)
  .get(getCategories);

router
  .route('/:id')
  .get(getCategoryById)
  .delete(authenticate, requireRole('ADMIN'), deleteCategory);

router
  .route('/:id/athletes')
  .post(authenticate, requireRole('ADMIN'), assignAthleteToCategory);

router
  .route('/:id/athletes/:athleteId')
  .delete(authenticate, requireRole('ADMIN'), removeAthleteFromCategory);

router.route('/:id/podium').get(getPodium);

export default router;
