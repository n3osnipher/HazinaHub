import { Router } from 'express';
import { getPortfolioSummary, requestWithdrawal } from '../controllers/portfolio.controller';
import { authenticate } from '../middleware/auth';
import { withdrawalValidation } from '../middleware/validation';
import { auditLog } from '../middleware/auditLog';

const router = Router();

router.get('/summary', authenticate, getPortfolioSummary);
router.post('/withdraw', authenticate, withdrawalValidation, auditLog('withdrawal', 'portfolio'), requestWithdrawal);

export default router;
