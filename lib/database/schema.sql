-- Users subscription table
CREATE TABLE IF NOT EXISTS users_subscription (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) UNIQUE NOT NULL, -- Clerk user ID
  tier VARCHAR(50) NOT NULL CHECK (tier IN ('premium', 'limitless', 'trial')),
  stripe_customer_id VARCHAR(255) UNIQUE,
  stripe_subscription_id VARCHAR(255) UNIQUE,
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'trial', 'suspended')),
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Token usage tracking table
CREATE TABLE IF NOT EXISTS token_usage (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  tokens_used INTEGER NOT NULL,
  tokens_estimated INTEGER,
  cost_per_token DECIMAL(10, 8),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  billing_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  billing_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  chat_id VARCHAR(255),
  message_id VARCHAR(255),
  message_type VARCHAR(50) CHECK (message_type IN ('text', 'image', 'file')),
  model_used VARCHAR(100),
  FOREIGN KEY (user_id) REFERENCES users_subscription(user_id) ON DELETE CASCADE
);

-- Monthly usage cache for quick lookups
CREATE TABLE IF NOT EXISTS monthly_usage_cache (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) UNIQUE NOT NULL,
  billing_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  billing_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  total_tokens INTEGER DEFAULT 0,
  total_requests INTEGER DEFAULT 0,
  tokens_remaining INTEGER,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users_subscription(user_id) ON DELETE CASCADE
);

-- Request rate limiting table
CREATE TABLE IF NOT EXISTS request_rate_limit (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  request_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  endpoint VARCHAR(255),
  FOREIGN KEY (user_id) REFERENCES users_subscription(user_id) ON DELETE CASCADE
);

-- Payment history table
CREATE TABLE IF NOT EXISTS payment_history (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  stripe_payment_intent_id VARCHAR(255) UNIQUE,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(50) NOT NULL,
  tier VARCHAR(50) NOT NULL,
  billing_period_start TIMESTAMP WITH TIME ZONE,
  billing_period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users_subscription(user_id) ON DELETE CASCADE
);

-- Usage alerts table
CREATE TABLE IF NOT EXISTS usage_alerts (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('80_percent', '90_percent', '95_percent', '100_percent')),
  tokens_used INTEGER NOT NULL,
  tokens_limit INTEGER NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  billing_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users_subscription(user_id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_token_usage_user_period ON token_usage(user_id, billing_period_start, billing_period_end);
CREATE INDEX idx_token_usage_timestamp ON token_usage(timestamp);
CREATE INDEX idx_request_rate_limit_user_time ON request_rate_limit(user_id, request_timestamp);
CREATE INDEX idx_usage_alerts_user_period ON usage_alerts(user_id, billing_period_start);
CREATE INDEX idx_monthly_usage_cache_user ON monthly_usage_cache(user_id);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
CREATE TRIGGER update_users_subscription_updated_at BEFORE UPDATE
    ON users_subscription FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate tokens remaining
CREATE OR REPLACE FUNCTION calculate_tokens_remaining(
    p_user_id VARCHAR(255),
    p_period_start TIMESTAMP WITH TIME ZONE,
    p_period_end TIMESTAMP WITH TIME ZONE
)
RETURNS INTEGER AS $$
DECLARE
    v_total_used INTEGER;
    v_token_limit INTEGER;
    v_tier VARCHAR(50);
BEGIN
    -- Get user's tier and token limit
    SELECT tier INTO v_tier
    FROM users_subscription
    WHERE user_id = p_user_id;

    -- Set token limit based on tier
    CASE v_tier
        WHEN 'premium' THEN v_token_limit := 25000;
        WHEN 'limitless' THEN v_token_limit := 100000;
        WHEN 'trial' THEN v_token_limit := 1000;
        ELSE v_token_limit := 0;
    END CASE;

    -- Calculate total tokens used in period
    SELECT COALESCE(SUM(tokens_used), 0) INTO v_total_used
    FROM token_usage
    WHERE user_id = p_user_id
    AND timestamp >= p_period_start
    AND timestamp < p_period_end;

    RETURN GREATEST(0, v_token_limit - v_total_used);
END;
$$ LANGUAGE plpgsql;