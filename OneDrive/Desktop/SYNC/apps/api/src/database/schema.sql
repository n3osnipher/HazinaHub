-- ═══════════════════════════════════════════════════════════
-- HazinaHub Database Schema
-- PostgreSQL 16+
-- ═══════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Users ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    business_name VARCHAR(255),
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin')),
    is_verified BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    auto_invest_enabled BOOLEAN DEFAULT false,
    auto_invest_percentage DECIMAL(5,2) DEFAULT 0,
    auto_invest_fund_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Transactions ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('c2b', 'b2c', 'stk_push', 'withdrawal')),
    amount DECIMAL(15,2) NOT NULL,
    phone VARCHAR(20),
    mpesa_receipt_number VARCHAR(50),
    merchant_request_id VARCHAR(100),
    checkout_request_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
    description TEXT,
    result_code INTEGER,
    result_desc TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Money Market Funds ────────────────────────────────────
CREATE TABLE IF NOT EXISTS mmf_funds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    provider VARCHAR(255) NOT NULL,
    interest_rate DECIMAL(6,3) NOT NULL,
    minimum_investment DECIMAL(15,2) DEFAULT 1000,
    risk_level VARCHAR(10) DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high')),
    maturity_days INTEGER DEFAULT 30,
    total_aum DECIMAL(20,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Investments ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS investments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fund_id UUID NOT NULL REFERENCES mmf_funds(id),
    amount DECIMAL(15,2) NOT NULL,
    accrued_interest DECIMAL(15,4) DEFAULT 0,
    current_value DECIMAL(15,4),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('active', 'matured', 'withdrawn', 'pending')),
    invested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    matures_at TIMESTAMP,
    withdrawn_at TIMESTAMP,
    transaction_id UUID REFERENCES transactions(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Portfolio Snapshots (daily tracking) ──────────────────
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_invested DECIMAL(15,2) NOT NULL,
    current_value DECIMAL(15,4) NOT NULL,
    total_returns DECIMAL(15,4) NOT NULL,
    snapshot_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, snapshot_date)
);

-- ─── AI Insights ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL CHECK (type IN ('investment_advice', 'risk_assessment', 'revenue_prediction', 'financial_health')),
    content TEXT NOT NULL,
    risk_score DECIMAL(5,2),
    confidence DECIMAL(5,2),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Audit Logs ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    resource_id VARCHAR(100),
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Notifications ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(10) DEFAULT 'in_app' CHECK (type IN ('sms', 'in_app', 'email')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Fraud Alerts ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fraud_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES transactions(id),
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(10) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description TEXT NOT NULL,
    is_resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Indexes ───────────────────────────────────────────────
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_investments_user_id ON investments(user_id);
CREATE INDEX idx_investments_fund_id ON investments(fund_id);
CREATE INDEX idx_investments_status ON investments(status);
CREATE INDEX idx_portfolio_snapshots_user_date ON portfolio_snapshots(user_id, snapshot_date);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_notifications_user_id ON notifications(user_id, is_read);
CREATE INDEX idx_fraud_alerts_user_id ON fraud_alerts(user_id);

-- ─── Seed: Default MMF Funds ───────────────────────────────
INSERT INTO mmf_funds (name, provider, interest_rate, minimum_investment, risk_level, maturity_days, total_aum, description) VALUES
    ('CIC Money Market Fund', 'CIC Asset Management', 14.5, 1000, 'low', 0, 52000000000, 'A low-risk fund investing in short-term money market instruments with daily liquidity.'),
    ('ICEA Lion Money Market Fund', 'ICEA Lion Asset Management', 13.8, 5000, 'low', 0, 38000000000, 'Invests in high-quality short-term securities with competitive returns.'),
    ('Sanlam Money Market Fund', 'Sanlam Investments', 14.2, 2500, 'low', 0, 25000000000, 'Focuses on capital preservation with attractive yields from government securities.'),
    ('Cytonn Money Market Fund', 'Cytonn Investments', 16.1, 1000, 'medium', 0, 18000000000, 'Higher yield fund with exposure to corporate commercial paper and fixed deposits.'),
    ('Nabo Africa Money Market Fund', 'Nabo Capital', 13.5, 10000, 'low', 0, 12000000000, 'Conservative fund targeting institutional and retail investors.'),
    ('Zimele Money Market Fund', 'Zimele Asset Management', 15.0, 1000, 'medium', 0, 8000000000, 'Balanced approach between government and corporate securities.'),
    ('GenAfrica Money Market Fund', 'GenAfrica Asset Managers', 14.8, 5000, 'low', 0, 15000000000, 'Premium fund with strong track record in the Kenyan market.'),
    ('Old Mutual Money Market Fund', 'Old Mutual Investment Group', 13.2, 5000, 'low', 0, 45000000000, 'East Africa''s largest money market fund with unmatched liquidity.')
ON CONFLICT DO NOTHING;
