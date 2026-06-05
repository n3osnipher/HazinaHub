import { Router } from 'express';
import { register, login, refreshToken, getProfile } from '../controllers/auth.controller';
import { registerValidation, loginValidation } from '../middleware/validation';
import { authenticate } from '../middleware/auth';
import { auditLog } from '../middleware/auditLog';

const router = Router();

router.post('/register', registerValidation, auditLog('register', 'auth'), register);
router.post('/login', loginValidation, auditLog('login', 'auth'), login);
router.post('/refresh', refreshToken);
router.get('/profile', authenticate, getProfile);

export default router;
