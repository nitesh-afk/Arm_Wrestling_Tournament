import express from 'express';
import {
  getMatches,
  getMatchById,
  callMatchToTable,
  startMatchOnTable,
  updateLiveScore,
  completeMatch,
  getTableQueues,
} from '../controllers/matchController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = express.Router();

// Match Query Routes
router.route('/').get(getMatches);
router.route('/:id').get(getMatchById);

// Table Staging & Live Scoring Pad Routes
router
  .route('/:id/call')
  .patch(authenticate, requireRole('ADMIN', 'REFEREE'), callMatchToTable);

router
  .route('/:id/start')
  .patch(authenticate, requireRole('ADMIN', 'REFEREE'), startMatchOnTable);

router
  .route('/:id/score')
  .patch(authenticate, requireRole('ADMIN', 'REFEREE'), updateLiveScore);

router
  .route('/:id/complete')
  .post(authenticate, requireRole('ADMIN', 'REFEREE'), completeMatch);

export default router;
export { getTableQueues };
