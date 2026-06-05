import { Router } from 'express';
import {
  getTransactions,
  initiatePayment,
  initiateWithdraw,
  stkCallback,
  c2bConfirmation,
  c2bValidation,
  getTransactionStatus,
  balanceCallback,
  balanceTimeout,
  b2cCallback,
  b2cTimeout,
} from '../controllers/transaction.controller';
import { authenticate } from '../middleware/auth';
import { transactionQueryValidation } from '../middleware/validation';
import { auditLog } from '../middleware/auditLog';

const router = Router();

// Protected routes
router.get('/', authenticate, transactionQueryValidation, getTransactions);
router.post('/pay', authenticate, auditLog('payment', 'transaction'), initiatePayment);
router.post('/withdraw', authenticate, auditLog('withdrawal', 'transaction'), initiateWithdraw);
router.get('/:id/status', authenticate, getTransactionStatus);

// M-Pesa webhook callbacks (no auth — called by Safaricom)
router.post('/mpesa/stk/callback', stkCallback);
router.post('/mpesa/c2b/confirm', c2bConfirmation);
router.post('/mpesa/c2b/validate', c2bValidation);
router.post('/mpesa/balance/result', balanceCallback);
router.post('/mpesa/balance/timeout', balanceTimeout);
router.post('/mpesa/b2c/result', b2cCallback);
router.post('/mpesa/b2c/timeout', b2cTimeout);

export default router;
