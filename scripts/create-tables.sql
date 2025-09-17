-- Create users_subscription table
CREATE TABLE IF NOT EXISTS users_subscription (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) UNIQUE NOT NULL,
  tier VARCHAR(50) NOT NULL CHECK (tier IN ('free', 'starter', 'premium', 'limitless', 'trial')),
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  current_period_start TIMESTAMP NOT NULL,
  current_period_end TIMESTAMP NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'trial', 'suspended')),
  trial_ends_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create token_usage table
CREATE TABLE IF NOT EXISTS token_usage (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  tokens_used INTEGER NOT NULL,
  tokens_estimated INTEGER,
  timestamp TIMESTAMP NOT NULL,
  billing_period_start TIMESTAMP,
  billing_period_end TIMESTAMP,
  chat_id VARCHAR(255),
  message_id VARCHAR(255),
  message_type VARCHAR(50),
  model_used VARCHAR(100),
  cost_per_token DECIMAL(10, 6),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create monthly_usage_cache table
CREATE TABLE IF NOT EXISTS monthly_usage_cache (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) UNIQUE NOT NULL,
  billing_period_start TIMESTAMP NOT NULL,
  billing_period_end TIMESTAMP NOT NULL,
  total_tokens INTEGER NOT NULL,
  total_requests INTEGER NOT NULL,
  tokens_remaining INTEGER NOT NULL,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create usage_alerts table
CREATE TABLE IF NOT EXISTS usage_alerts (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  alert_type VARCHAR(50) NOT NULL,
  tokens_used INTEGER NOT NULL,
  tokens_limit INTEGER NOT NULL,
  billing_period_start TIMESTAMP NOT NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create request_rate_limit table
CREATE TABLE IF NOT EXISTS request_rate_limit (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  request_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_token_usage_user_id ON token_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_timestamp ON token_usage(timestamp);
CREATE INDEX IF NOT EXISTS idx_token_usage_billing_period ON token_usage(user_id, billing_period_start, billing_period_end);
CREATE INDEX IF NOT EXISTS idx_request_rate_limit_user_timestamp ON request_rate_limit(user_id, request_timestamp);
CREATE INDEX IF NOT EXISTS idx_usage_alerts_user_period ON usage_alerts(user_id, billing_period_start);

-- Add triggers to update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_subscription_updated_at BEFORE UPDATE
  ON users_subscription FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Grant permissions (if needed for Row Level Security)
ALTER TABLE users_subscription ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_usage_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_rate_limit ENABLE ROW LEVEL SECURITY;