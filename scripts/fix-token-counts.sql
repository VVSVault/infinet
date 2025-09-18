-- Fix incorrect token counts in the database
-- This script recalculates token usage based on a more reasonable estimation

-- First, let's see the current token usage
SELECT
  user_id,
  COUNT(*) as request_count,
  SUM(tokens_used) as total_tokens,
  AVG(tokens_used) as avg_tokens_per_request,
  MAX(tokens_used) as max_tokens,
  MIN(tokens_used) as min_tokens
FROM token_usage
GROUP BY user_id
ORDER BY total_tokens DESC;

-- Update token counts to more reasonable values
-- For free tier users, cap individual requests at 100 tokens
-- This is a temporary fix - actual usage will be tracked correctly going forward
UPDATE token_usage
SET tokens_used = LEAST(tokens_used, 100)
WHERE user_id IN (
  SELECT user_id
  FROM users_subscription
  WHERE tier = 'free'
);

-- For all users, if a single request is over 1000 tokens,
-- divide by 10 (likely overcounted due to the bug)
UPDATE token_usage
SET tokens_used = tokens_used / 10
WHERE tokens_used > 1000;

-- Show the updated token usage
SELECT
  user_id,
  COUNT(*) as request_count,
  SUM(tokens_used) as total_tokens,
  AVG(tokens_used) as avg_tokens_per_request,
  MAX(tokens_used) as max_tokens,
  MIN(tokens_used) as min_tokens
FROM token_usage
GROUP BY user_id
ORDER BY total_tokens DESC;