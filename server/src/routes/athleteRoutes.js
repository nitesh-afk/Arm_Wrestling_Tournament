import express from 'express';
import {
  registerAthlete,
  getAllAthletes,
  getAthleteById,
  updateAthlete,
  recordWeighIn,
  deleteAthlete,
} from '../controllers/athleteController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = express.Router();

router.route('/').post(registerAthlete).get(getAllAthletes);

router
  .route('/:id')
  .get(getAthleteById)
  .patch(authenticate, updateAthlete)
  .delete(authenticate, requireRole('ADMIN'), deleteAthlete);

router
  .route('/:id/weigh-in')
  .patch(authenticate, requireRole('ADMIN', 'REFEREE'), recordWeighIn);

export default router;
