import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { validationResult } from 'express-validator';
import { User } from '../models/User';
import { AuthRequest } from '../middleware/auth';

function generateTokens(userId: string, role: string) {
  const jwtSecret = process.env.JWT_SECRET || 'default_secret';
  const refreshSecret = process.env.JWT_REFRESH_SECRET || 'default_refresh_secret';
  
  const accessToken = jwt.sign({ userId, role }, jwtSecret, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId, role }, refreshSecret, { expiresIn: '7d' });
  return { accessToken, refreshToken };
}

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0].msg;
      res.status(400).json({ success: false, error: firstError, errors: errors.array() });
      return;
    }

    const { email, password, phone, firstName, lastName, businessName } = req.body;

    // Check if user exists
    const existing = await User.findOne({ email });
    if (existing) {
      res.status(409).json({ success: false, error: 'Email already registered' });
      return;
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Normalize phone
    let normalizedPhone = phone.replace(/\D/g, '');
    if (normalizedPhone.startsWith('0')) normalizedPhone = '254' + normalizedPhone.substring(1);

    // Create user in MongoDB
    const user = new User({
      email,
      password: passwordHash,
      phone: normalizedPhone,
      first_name: firstName,
      last_name: lastName,
      business_name: businessName,
    });
    
    await user.save();

    const tokens = generateTokens(user._id.toString(), 'user');

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          phone: user.phone,
          firstName: user.first_name,
          lastName: user.last_name,
          businessName: user.business_name,
          role: 'user',
        },
        ...tokens,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0].msg;
      res.status(400).json({ success: false, error: firstError, errors: errors.array() });
      return;
    }

    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const tokens = generateTokens(user._id.toString(), 'user');

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          phone: user.phone,
          firstName: user.first_name,
          lastName: user.last_name,
          businessName: user.business_name,
          role: 'user',
        },
        ...tokens,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
};

export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) {
      res.status(400).json({ success: false, error: 'Refresh token required' });
      return;
    }

    const refreshSecret = process.env.JWT_REFRESH_SECRET || 'default_refresh_secret';
    const decoded = jwt.verify(token, refreshSecret) as { userId: string; role: string };
    const tokens = generateTokens(decoded.userId, decoded.role);

    res.json({ success: true, data: tokens });
  } catch (error) {
    res.status(401).json({ success: false, error: 'Invalid refresh token' });
  }
};

export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        id: user._id,
        email: user.email,
        phone: user.phone,
        firstName: user.first_name,
        lastName: user.last_name,
        businessName: user.business_name,
        role: 'user',
        isVerified: true,
        autoInvestEnabled: false,
        autoInvestPercentage: 0,
        createdAt: user.createdAt,
      },
    });
  } catch (error: any) {
    console.error('🚨 getProfile Error:', error.message || error);
    res.status(500).json({ success: false, error: 'Failed to get profile', details: error.message });
  }
};
