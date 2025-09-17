import { sql, query } from './postgres-client'
import { SUBSCRIPTION_TIERS } from '../subscription-tiers'

export interface UserSubscription {
  user_id: string
  tier: 'free' | 'starter' | 'premium' | 'limitless' | 'trial'
  stripe_customer_id?: string
  stripe_subscription_id?: string
  current_period_start: Date
  current_period_end: Date
  status: 'active' | 'canceled' | 'past_due' | 'trial' | 'suspended'
  trial_ends_at?: Date
}

export interface TokenUsage {
  user_id: string
  tokens_used: number
  tokens_estimated?: number
  timestamp: Date
  billing_period_start: Date
  billing_period_end: Date
  chat_id?: string
  message_id?: string
  message_type?: 'text' | 'image' | 'file'
  model_used?: string
}

export interface MonthlyUsageCache {
  user_id: string
  billing_period_start: string | Date
  billing_period_end: string | Date
  total_tokens: number
  total_requests: number
  tokens_remaining: number
  last_updated: string | Date
}

// Get user subscription
export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
  try {
    const result = await sql`
      SELECT * FROM users_subscription
      WHERE user_id = ${userId}
      AND status IN ('active', 'trial')
      LIMIT 1
    `

    // If no subscription found, return a free tier subscription
    if (!result.rows[0]) {
      const now = new Date()
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days

      return {
        user_id: userId,
        tier: 'free',
        status: 'active',
        current_period_start: now,
        current_period_end: periodEnd,
      }
    }

    return result.rows[0] as UserSubscription
  } catch (error) {
    console.error('Error fetching user subscription:', error)
    // Return free tier on error
    const now = new Date()
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    return {
      user_id: userId,
      tier: 'free',
      status: 'active',
      current_period_start: now,
      current_period_end: periodEnd,
    }
  }
}

// Create or update subscription
export async function upsertSubscription(subscription: UserSubscription): Promise<void> {
  try {
    await sql`
      INSERT INTO users_subscription (
        user_id, tier, stripe_customer_id, stripe_subscription_id,
        current_period_start, current_period_end, status, trial_ends_at
      ) VALUES (
        ${subscription.user_id}, ${subscription.tier}, ${subscription.stripe_customer_id},
        ${subscription.stripe_subscription_id}, ${subscription.current_period_start?.toISOString()},
        ${subscription.current_period_end?.toISOString()}, ${subscription.status}, ${subscription.trial_ends_at?.toISOString()}
      )
      ON CONFLICT (user_id) DO UPDATE SET
        tier = EXCLUDED.tier,
        stripe_customer_id = EXCLUDED.stripe_customer_id,
        stripe_subscription_id = EXCLUDED.stripe_subscription_id,
        current_period_start = EXCLUDED.current_period_start,
        current_period_end = EXCLUDED.current_period_end,
        status = EXCLUDED.status,
        trial_ends_at = EXCLUDED.trial_ends_at,
        updated_at = CURRENT_TIMESTAMP
    `
  } catch (error) {
    console.error('Error upserting subscription:', error)
    throw error
  }
}

// Track token usage
export async function trackTokenUsage(usage: TokenUsage): Promise<void> {
  try {
    // Insert usage record
    await sql`
      INSERT INTO token_usage (
        user_id, tokens_used, tokens_estimated, timestamp,
        billing_period_start, billing_period_end, chat_id, message_id,
        message_type, model_used, cost_per_token
      ) VALUES (
        ${usage.user_id}, ${usage.tokens_used}, ${usage.tokens_estimated},
        ${usage.timestamp.toISOString()}, ${usage.billing_period_start?.toISOString()}, ${usage.billing_period_end?.toISOString()},
        ${usage.chat_id}, ${usage.message_id}, ${usage.message_type}, ${usage.model_used},
        ${calculateCostPerToken(usage.user_id)}
      )
    `

    // Update cache
    await updateMonthlyUsageCache(usage.user_id)
  } catch (error) {
    console.error('Error tracking token usage:', error)
    throw error
  }
}

// Get monthly usage
export async function getMonthlyUsage(userId: string): Promise<MonthlyUsageCache | null> {
  try {
    const subscription = await getUserSubscription(userId)
    if (!subscription) return null

    const result = await sql`
      SELECT
        ${userId} as user_id,
        ${subscription.current_period_start?.toISOString()} as billing_period_start,
        ${subscription.current_period_end?.toISOString()} as billing_period_end,
        COALESCE(SUM(tokens_used), 0) as total_tokens,
        COUNT(*) as total_requests,
        ${getTokenLimit(subscription.tier)} - COALESCE(SUM(tokens_used), 0) as tokens_remaining
      FROM token_usage
      WHERE user_id = ${userId}
        AND timestamp >= ${subscription.current_period_start?.toISOString()}
        AND timestamp < ${subscription.current_period_end?.toISOString()}
    `

    const usage = result.rows[0] as MonthlyUsageCache

    console.log('Monthly usage for user:', {
      userId,
      tier: subscription.tier,
      tokenLimit: getTokenLimit(subscription.tier),
      totalTokensUsed: usage?.total_tokens || 0,
      tokensRemaining: usage?.tokens_remaining || getTokenLimit(subscription.tier),
      totalRequests: usage?.total_requests || 0
    })

    return usage || null
  } catch (error) {
    console.error('Error fetching monthly usage:', error)
    // Return default free tier usage on error (for new users)
    const now = new Date()
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    return {
      user_id: userId,
      billing_period_start: now,
      billing_period_end: periodEnd,
      total_tokens: 0,
      total_requests: 0,
      tokens_remaining: 500, // Free tier limit
      last_updated: now
    }
  }
}

// Update monthly usage cache
async function updateMonthlyUsageCache(userId: string): Promise<void> {
  try {
    const usage = await getMonthlyUsage(userId)
    if (!usage) return

    await sql`
      INSERT INTO monthly_usage_cache (
        user_id, billing_period_start, billing_period_end,
        total_tokens, total_requests, tokens_remaining, last_updated
      ) VALUES (
        ${usage.user_id},
        ${usage.billing_period_start instanceof Date ? usage.billing_period_start.toISOString() : usage.billing_period_start},
        ${usage.billing_period_end instanceof Date ? usage.billing_period_end.toISOString() : usage.billing_period_end},
        ${usage.total_tokens}, ${usage.total_requests}, ${usage.tokens_remaining},
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (user_id) DO UPDATE SET
        billing_period_start = EXCLUDED.billing_period_start,
        billing_period_end = EXCLUDED.billing_period_end,
        total_tokens = EXCLUDED.total_tokens,
        total_requests = EXCLUDED.total_requests,
        tokens_remaining = EXCLUDED.tokens_remaining,
        last_updated = CURRENT_TIMESTAMP
    `
  } catch (error) {
    console.error('Error updating monthly usage cache:', error)
  }
}

// Check rate limit (daily)
export async function checkRateLimit(userId: string, tier: string): Promise<boolean> {
  if (tier === 'limitless') return true // Unlimited requests

  let limit: number
  switch (tier) {
    case 'free':
      limit = 10 // 10 requests per day
      break
    case 'starter':
      limit = 30 // 30 requests per day
      break
    case 'premium':
      limit = 60 // 60 requests per day
      break
    case 'trial':
      limit = 20 // 20 requests per day
      break
    default:
      limit = 10
  }

  try {
    const result = await sql`
      SELECT COUNT(*) as request_count
      FROM request_rate_limit
      WHERE user_id = ${userId}
        AND request_timestamp > NOW() - INTERVAL '1 day'
    `

    const count = parseInt(result.rows[0]?.request_count || '0')
    return count < limit
  } catch (error) {
    console.error('Error checking rate limit:', error)
    return false
  }
}

// Log request for rate limiting
export async function logRequest(userId: string, endpoint: string): Promise<void> {
  try {
    await sql`
      INSERT INTO request_rate_limit (user_id, endpoint, request_timestamp)
      VALUES (${userId}, ${endpoint}, CURRENT_TIMESTAMP)
    `
  } catch (error) {
    console.error('Error logging request:', error)
  }
}

// Check if user has exceeded token limit
export async function hasExceededTokenLimit(userId: string): Promise<boolean> {
  const usage = await getMonthlyUsage(userId)
  // If no usage data exists (new user), they haven't exceeded the limit yet
  return usage ? usage.tokens_remaining <= 0 : false
}

// Get token limit for tier
function getTokenLimit(tier: string): number {
  switch (tier) {
    case 'free':
      return 500
    case 'starter':
      return 10000
    case 'premium':
      return 50000
    case 'limitless':
      return 100000
    case 'trial':
      return 1000
    default:
      return 500 // Default to free tier
  }
}

// Calculate cost per token
function calculateCostPerToken(userId: string): number {
  // This would fetch the user's tier and calculate based on that
  // For now, returning a default value
  return 0.002 // $0.002 per token for premium tier
}

// Check and send usage alerts
export async function checkUsageAlerts(userId: string): Promise<void> {
  const usage = await getMonthlyUsage(userId)
  const subscription = await getUserSubscription(userId)

  if (!usage || !subscription) return

  const limit = getTokenLimit(subscription.tier)
  const percentage = (usage.total_tokens / limit) * 100

  // Check which alerts to send
  const thresholds = [
    { percentage: 80, type: '80_percent' },
    { percentage: 90, type: '90_percent' },
    { percentage: 95, type: '95_percent' },
    { percentage: 100, type: '100_percent' },
  ]

  for (const threshold of thresholds) {
    if (percentage >= threshold.percentage) {
      // Check if alert was already sent for this period
      const existing = await sql`
        SELECT id FROM usage_alerts
        WHERE user_id = ${userId}
          AND alert_type = ${threshold.type}
          AND billing_period_start = ${subscription.current_period_start?.toISOString()}
        LIMIT 1
      `

      if (existing.rows.length === 0) {
        // Send alert
        await sql`
          INSERT INTO usage_alerts (
            user_id, alert_type, tokens_used, tokens_limit,
            billing_period_start, sent_at
          ) VALUES (
            ${userId}, ${threshold.type}, ${usage.total_tokens},
            ${limit}, ${subscription.current_period_start?.toISOString()}, CURRENT_TIMESTAMP
          )
        `

        // Here you would also send an email/notification to the user
        console.log(`Usage alert sent: ${userId} at ${percentage}%`)
      }
    }
  }
}

// Get or create user
export async function getOrCreateUser(clerkId: string, email: string): Promise<any> {
  try {
    // First check if user exists
    const existing = await sql`
      SELECT * FROM users_subscription
      WHERE user_id = ${clerkId}
      LIMIT 1
    `

    if (existing.rows[0]) {
      return { id: clerkId, ...existing.rows[0] }
    }

    // Create new user with free tier
    const now = new Date()
    const endOfMonth = new Date(now)
    endOfMonth.setMonth(endOfMonth.getMonth() + 1)

    await sql`
      INSERT INTO users_subscription (
        user_id, tier, status, stripe_customer_id,
        current_period_start, current_period_end
      ) VALUES (
        ${clerkId}, 'free', 'active', NULL,
        ${now.toISOString()}, ${endOfMonth.toISOString()}
      )
    `

    // Also initialize their usage cache
    await sql`
      INSERT INTO monthly_usage_cache (
        user_id, billing_period_start, billing_period_end,
        total_tokens, total_requests, tokens_remaining, last_updated
      ) VALUES (
        ${clerkId}, ${now.toISOString()}, ${endOfMonth.toISOString()},
        0, 0, 500, CURRENT_TIMESTAMP
      )
    `

    return { id: clerkId, email, tier: 'free', status: 'active' }
  } catch (error) {
    console.error('Error in getOrCreateUser:', error)
    return null
  }
}

// Update user subscription
export async function updateUserSubscription(
  userId: string,
  updates: {
    subscription_tier?: string
    subscription_status?: string
    stripe_subscription_id?: string
    stripe_customer_id?: string
    tokens_limit?: number
    subscription_period_start?: Date
    subscription_period_end?: Date
  }
): Promise<boolean> {
  try {
    const params: any = {}
    const sets: string[] = []

    if (updates.subscription_tier) {
      params.tier = updates.subscription_tier
      sets.push('tier = ${tier}')
    }
    if (updates.subscription_status) {
      params.status = updates.subscription_status
      sets.push('status = ${status}')
    }
    if (updates.stripe_subscription_id) {
      params.stripe_subscription_id = updates.stripe_subscription_id
      sets.push('stripe_subscription_id = ${stripe_subscription_id}')
    }
    if (updates.stripe_customer_id) {
      params.stripe_customer_id = updates.stripe_customer_id
      sets.push('stripe_customer_id = ${stripe_customer_id}')
    }
    if (updates.subscription_period_start) {
      params.period_start = updates.subscription_period_start.toISOString()
      sets.push('current_period_start = ${period_start}')
    }
    if (updates.subscription_period_end) {
      params.period_end = updates.subscription_period_end.toISOString()
      sets.push('current_period_end = ${period_end}')
    }

    if (sets.length === 0) return true

    // Build and execute the update query dynamically
    const setParts: string[] = []
    const values: any[] = []
    let paramCount = 1

    if (updates.subscription_tier) {
      setParts.push(`tier = $${paramCount++}`)
      values.push(updates.subscription_tier)
    }
    if (updates.subscription_status) {
      setParts.push(`status = $${paramCount++}`)
      values.push(updates.subscription_status)
    }
    if (updates.stripe_subscription_id) {
      setParts.push(`stripe_subscription_id = $${paramCount++}`)
      values.push(updates.stripe_subscription_id)
    }
    if (updates.stripe_customer_id) {
      setParts.push(`stripe_customer_id = $${paramCount++}`)
      values.push(updates.stripe_customer_id)
    }
    if (updates.subscription_period_start) {
      setParts.push(`current_period_start = $${paramCount++}`)
      values.push(updates.subscription_period_start.toISOString())
    }
    if (updates.subscription_period_end) {
      setParts.push(`current_period_end = $${paramCount++}`)
      values.push(updates.subscription_period_end.toISOString())
    }

    values.push(userId)

    const queryText = `UPDATE users_subscription SET ${setParts.join(', ')} WHERE user_id = $${paramCount}`
    await query(queryText, values)

    // Update the cache if tier changed
    if (updates.subscription_tier) {
      const limit = getTokenLimit(updates.subscription_tier as any)
      await sql`
        UPDATE monthly_usage_cache
        SET tokens_remaining = ${limit} - total_tokens
        WHERE user_id = ${userId}
      `
    }

    return true
  } catch (error) {
    console.error('Error updating subscription:', error)
    return false
  }
}

// Get user by Stripe customer ID
export async function getUserByStripeCustomerId(customerId: string): Promise<any> {
  try {
    const result = await sql`
      SELECT * FROM users_subscription
      WHERE stripe_customer_id = ${customerId}
      LIMIT 1
    `
    return result.rows[0] ? { id: result.rows[0].user_id, ...result.rows[0] } : null
  } catch (error) {
    console.error('Error getting user by stripe ID:', error)
    return null
  }
}

// Get user by Clerk ID
export async function getUserByClerkId(clerkId: string): Promise<any> {
  try {
    const result = await sql`
      SELECT * FROM users_subscription
      WHERE user_id = ${clerkId}
      LIMIT 1
    `
    return result.rows[0] ? { id: clerkId, ...result.rows[0] } : null
  } catch (error) {
    console.error('Error getting user by clerk ID:', error)
    return null
  }
}

// Log subscription event
export async function logSubscriptionEvent(
  userId: string,
  eventType: string,
  tier?: string,
  status?: string,
  stripeEventId?: string,
  metadata?: any
): Promise<void> {
  try {
    await sql`
      INSERT INTO subscription_history (
        user_id, event_type, tier, status,
        stripe_event_id, metadata, created_at
      ) VALUES (
        ${userId}, ${eventType}, ${tier || null}, ${status || null},
        ${stripeEventId || null}, ${JSON.stringify(metadata) || null}, CURRENT_TIMESTAMP
      )
    `
  } catch (error) {
    console.error('Error logging subscription event:', error)
  }
}

// Reset monthly usage (for cron job)
export async function resetExpiredSubscriptions(): Promise<void> {
  try {
    // Find subscriptions that have passed their period end
    const expiredSubs = await sql`
      SELECT user_id, current_period_end FROM users_subscription
      WHERE status = 'active'
        AND current_period_end < CURRENT_TIMESTAMP
    `

    for (const sub of expiredSubs.rows) {
      // Update to new period (add 1 month)
      await sql`
        UPDATE users_subscription
        SET current_period_start = current_period_end,
            current_period_end = current_period_end + INTERVAL '1 month'
        WHERE user_id = ${sub.user_id}
      `

      // Clear cache
      await sql`
        DELETE FROM monthly_usage_cache
        WHERE user_id = ${sub.user_id}
      `

      console.log(`Reset subscription for user: ${sub.user_id}`)
    }
  } catch (error) {
    console.error('Error resetting expired subscriptions:', error)
  }
}