import { Router } from 'express';
import { getAvailableFunds, investInFund, getUserInvestments } from '../controllers/investment.controller';
import { authenticate } from '../middleware/auth';
import { investmentValidation } from '../middleware/validation';
import { auditLog } from '../middleware/auditLog';

const router = Router();

router.get('/funds', authenticate, getAvailableFunds);
router.post('/invest', authenticate, investmentValidation, auditLog('invest', 'investment'), investInFund);
router.get('/', authenticate, getUserInvestments);

export default router;
