// ─── User Types ─────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  businessName: string;
  role: "user" | "admin" | "super_admin";
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  phone: string;
  firstName: string;
  lastName: string;
  businessName: string;
}

// ─── Transaction Types ──────────────────────────────────────
export type TransactionType = "c2b" | "b2c" | "stk_push" | "withdrawal";
export type TransactionStatus =
  | "pending"
  | "completed"
  | "failed"
  | "cancelled";

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  phone: string;
  mpesaReceiptNumber?: string;
  status: TransactionStatus;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Investment Types ───────────────────────────────────────
export interface MMFund {
  id: string;
  name: string;
  provider: string;
  interestRate: number;
  minimumInvestment: number;
  riskLevel: "low" | "medium" | "high";
  maturityDays: number;
  totalAum: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type InvestmentStatus = "active" | "matured" | "withdrawn" | "pending";

export interface Investment {
  id: string;
  userId: string;
  fundId: string;
  amount: number;
  accruedInterest: number;
  currentValue: number;
  status: InvestmentStatus;
  investedAt: Date;
  maturesAt?: Date;
  withdrawnAt?: Date;
  fund?: MMFund;
}

// ─── Portfolio Types ────────────────────────────────────────
export interface Portfolio {
  totalInvested: number;
  currentValue: number;
  totalReturns: number;
  yieldPercentage: number;
  investments: Investment[];
  growthData: GrowthDataPoint[];
  withdrawalEligible: number;
}

export interface GrowthDataPoint {
  date: string;
  value: number;
}

// ─── Dashboard Types ────────────────────────────────────────
export interface DashboardSummary {
  accountBalance: number;
  totalSales: number;
  monthlyProfits: number;
  profitGrowth: number;
  weeklyTransactions: WeeklyDataPoint[];
  recentTransactions: Transaction[];
  aiInsight: string;
}

export interface WeeklyDataPoint {
  day: string;
  amount: number;
}

// ─── AI Insight Types ───────────────────────────────────────
export interface AIInsight {
  id: string;
  userId: string;
  type:
    | "investment_advice"
    | "risk_assessment"
    | "revenue_prediction"
    | "financial_health";
  content: string;
  riskScore?: number;
  confidence: number;
  createdAt: Date;
}

export interface FinancialHealthScore {
  overall: number;
  cashFlow: number;
  savings: number;
  investmentDiversity: number;
  debtRatio: number;
  recommendations: string[];
}

// ─── Notification Types ─────────────────────────────────────
export type NotificationType = "sms" | "in_app" | "email";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
}

// ─── API Response Types ─────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ─── Audit Log Types ────────────────────────────────────────
export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress: string;
  createdAt: Date;
}
