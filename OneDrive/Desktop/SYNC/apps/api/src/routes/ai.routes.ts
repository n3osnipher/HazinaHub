import { Router } from 'express';
import { analyzeTransactions, getAdvice, getHealthScore, getInsights, processChat } from '../controllers/ai.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/analyze', authenticate, analyzeTransactions);
router.post('/advice', authenticate, getAdvice);
router.get('/health-score', authenticate, getHealthScore);
router.get('/insights', authenticate, getInsights);
router.post('/chat', authenticate, processChat);

export default router;
