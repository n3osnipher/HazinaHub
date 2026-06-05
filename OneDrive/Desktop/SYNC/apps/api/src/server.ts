import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

// Load env before other imports
import path from 'path';
// Force absolute path for reliability during testing
dotenv.config({ path: 'C:\\Users\\ADMN\\OneDrive\\Desktop\\hazinahub\\.env' });

import authRoutes from './routes/auth.routes';
import dashboardRoutes from './routes/dashboard.routes';
import transactionRoutes from './routes/transaction.routes';
import investmentRoutes from './routes/investment.routes';
import portfolioRoutes from './routes/portfolio.routes';
import aiRoutes from './routes/ai.routes';

import { connectMongo } from './config/mongo';
connectMongo(); // Initialize MongoDB

import { startInterestAccrualJob } from './jobs/interestAccrual';
import { startMMFRateUpdater } from './jobs/mmfRateUpdater';
import { startAutoInvestJob } from './jobs/autoInvest';
import { startFraudDetectionJob } from './jobs/fraudDetection';

const app = express();
const PORT = process.env.API_PORT || 5000;

// ─── Middleware ─────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://hazinahub.co.ke']
    : true, // Dynamically reflect origin in dev
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Health Check ───────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'HazinaHub API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ─── API Routes ─────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/investments', investmentRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/ai', aiRoutes);

// ─── 404 Handler ────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// ─── Global Error Handler ───────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// ─── Start Server ───────────────────────────────────────────
import http from 'http';
import { initWebSocketServer } from './services/websocket.service';

const server = http.createServer(app);
initWebSocketServer(server);

server.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════╗
  ║         🏦 HazinaHub API Server          ║
  ║         Running on port ${PORT}             ║
  ║         Environment: ${process.env.NODE_ENV || 'development'}     ║
  ╚═══════════════════════════════════════════╝
  `);

  // Start cron jobs
  startInterestAccrualJob();
  startMMFRateUpdater();
  startAutoInvestJob();
  startFraudDetectionJob();
});

export default app;
