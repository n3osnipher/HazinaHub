export interface User {
  id: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  businessName: string;
  role: "user" | "admin" | "super_admin";
  isVerified: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
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

export type CashflowType =
  | "inflow"
  | "outflow"
  | "deposit"
  | "withdrawal"
  | "investment"
  | "return"
  | "fee"
  | "c2b"
  | "b2c"
  | "stk_push";

export type CashflowStatus = "pending" | "completed" | "failed" | "cancelled";

export interface Cashflow {
  id: string;
  userId: string;
  type: CashflowType;
  amount: number;
  phone?: string;
  receiptNumber?: string;
  status: CashflowStatus;
  description?: string;
  category?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface MMFund {
  id: string;
  name: string;
  provider: string;
  interestRate: number;
  minimumInvestment: number;
  riskLevel: "low" | "medium" | "high" | "sovereign";
  maturityDays: number;
  totalAum: number;
  isActive?: boolean;
  description?: string;
  websiteUrl?: string;
  logoUrl?: string;
  assetClass: "MMF" | "SACCO" | "T-Bill" | "Stock";
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export type InvestmentStatus = "active" | "matured" | "withdrawn" | "pending";

export interface Investment {
  id: string;
  userId?: string;
  fundId?: string;
  fundName?: string;
  provider?: string;
  amount: number;
  accruedInterest: number;
  currentValue: number;
  interestRate?: number;
  riskLevel?: "low" | "medium" | "high" | "sovereign";
  assetClass?: "MMF" | "SACCO" | "T-Bill" | "Stock";
  logoUrl?: string;
  status: InvestmentStatus;
  investedAt: Date | string;
  maturesAt?: Date | string | null;
  withdrawnAt?: Date | string | null;
  fund?: MMFund;
}

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

export interface ProfitLossPoint {
  day: string;
  revenue: number;
  expenses: number;
  net: number;
}

export interface DashboardSummary {
  accountBalance: number;
  totalSales: number;
  monthlyProfits: number;
  profitGrowth: number;
  weeklyCashflow: WeeklyDataPoint[];
  profitLossTrend: ProfitLossPoint[];
  financialHealth: FinancialHealthScore;
  recentCashflows: Cashflow[];
  aiInsight: string;
  expensesByCategory: { category: string; amount: number }[];
}

export interface WeeklyDataPoint {
  day: string;
  amount: number;
}

export interface FinancialHealthScore {
  overall: number;
  cashFlow: number;
  savings: number;
  investmentDiversity: number;
  debtRatio: number;
  recommendations: string[];
}

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
