import express from 'express';
import {
  createTournament,
  getAllTournaments,
  getTournamentById,
  updateTournament,
  deleteTournament,
} from '../controllers/tournamentController.js';
import { getTableQueues } from '../controllers/matchController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = express.Router();

router
  .route('/')
  .post(authenticate, requireRole('ADMIN'), createTournament)
  .get(getAllTournaments);

router
  .route('/:id')
  .get(getTournamentById)
  .patch(authenticate, requireRole('ADMIN'), updateTournament)
  .delete(authenticate, requireRole('ADMIN'), deleteTournament);

router.route('/:id/tables/queue').get(getTableQueues);

export default router;
