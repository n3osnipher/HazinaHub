import { body, param, query as queryValidator, ValidationChain } from 'express-validator';

export const registerValidation: ValidationChain[] = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must be at least 8 characters with uppercase, lowercase, and number'),
  body('phone').matches(/^(\+?254|0)[71]\d{8}$/).withMessage('Valid Kenyan phone number required'),
  body('firstName').trim().isLength({ min: 2 }).withMessage('First name is required'),
  body('lastName').trim().isLength({ min: 2 }).withMessage('Last name is required'),
  body('businessName').optional().trim(),
];

export const loginValidation: ValidationChain[] = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

export const investmentValidation: ValidationChain[] = [
  body('fundId').isUUID().withMessage('Valid fund ID is required'),
  body('amount').isFloat({ min: 1000 }).withMessage('Minimum investment is KES 1,000'),
  body('phone').matches(/^(\+?254|0)[71]\d{8}$/).withMessage('Valid Kenyan phone number required'),
];

export const transactionQueryValidation: ValidationChain[] = [
  queryValidator('page').optional().isInt({ min: 1 }).withMessage('Page must be positive integer'),
  queryValidator('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
  queryValidator('status').optional().isIn(['pending', 'completed', 'failed', 'cancelled']),
  queryValidator('type').optional().isIn(['c2b', 'b2c', 'stk_push', 'withdrawal']),
];

export const withdrawalValidation: ValidationChain[] = [
  body('investmentId').isUUID().withMessage('Valid investment ID is required'),
  body('amount').isFloat({ min: 100 }).withMessage('Minimum withdrawal is KES 100'),
];

export const uuidParam: ValidationChain[] = [
  param('id').isUUID().withMessage('Valid ID is required'),
];
