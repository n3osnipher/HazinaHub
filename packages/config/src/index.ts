export const APP_CONFIG = {
  name: 'HazinaHub',
  description: 'Fintech Platform for Kenyan Small Businesses',
  version: '1.0.0',
  currency: 'KES',
  locale: 'en-KE',
  timezone: 'Africa/Nairobi',
} as const;

export const API_ENDPOINTS = {
  auth: {
    login: '/api/auth/login',
    register: '/api/auth/register',
    refresh: '/api/auth/refresh',
    logout: '/api/auth/logout',
  },
  dashboard: {
    summary: '/api/dashboard/summary',
  },
  transactions: {
    list: '/api/transactions',
    create: '/api/transactions',
    status: (id: string) => `/api/transactions/${id}/status`,
  },
  investments: {
    funds: '/api/investments/funds',
    invest: '/api/investments/invest',
    list: '/api/investments',
    detail: (id: string) => `/api/investments/${id}`,
  },
  portfolio: {
    summary: '/api/portfolio/summary',
    withdraw: '/api/portfolio/withdraw',
  },
  ai: {
    analyze: '/api/ai/analyze',
    advice: '/api/ai/advice',
    insights: '/api/ai/insights',
    healthScore: '/api/ai/health-score',
  },
} as const;

export const MPESA_CONFIG = {
  sandbox: {
    baseUrl: 'https://sandbox.safaricom.co.ke',
    oauthUrl: 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    stkPushUrl: 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
    c2bRegisterUrl: 'https://sandbox.safaricom.co.ke/mpesa/c2b/v1/registerurl',
    transactionStatusUrl: 'https://sandbox.safaricom.co.ke/mpesa/transactionstatus/v1/query',
  },
  production: {
    baseUrl: 'https://api.safaricom.co.ke',
    oauthUrl: 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    stkPushUrl: 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
    c2bRegisterUrl: 'https://api.safaricom.co.ke/mpesa/c2b/v1/registerurl',
    transactionStatusUrl: 'https://api.safaricom.co.ke/mpesa/transactionstatus/v1/query',
  },
} as const;

export const MMF_DEFAULTS = {
  minInvestment: 1000,
  maxInvestment: 10_000_000,
  minMaturityDays: 30,
  interestAccrualHour: 0, // midnight EAT
} as const;

export const SECURITY_CONFIG = {
  passwordMinLength: 8,
  maxLoginAttempts: 5,
  lockoutDuration: 15 * 60 * 1000, // 15 minutes
  tokenRotationInterval: 24 * 60 * 60 * 1000, // 24 hours
} as const;
