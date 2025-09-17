import { supabase, User, UsageLog, SubscriptionHistory } from './supabase'
import { SUBSCRIPTION_TIERS } from './subscription-tiers'

// User management functions
export async function getOrCreateUser(clerkId: string, email: string): Promise<User | null> {
  try {
    // First try to get existing user
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('clerk_id', clerkId)
      .single()

    if (existingUser) {
      return existingUser
    }

    // Create new user if doesn't exist
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert([
        {
          clerk_id: clerkId,
          email: email,
          subscription_tier: 'free',
          subscription_status: 'inactive',
          tokens_used: 0,
          tokens_limit: 0,
        },
      ])
      .select()
      .single()

    if (createError) {
      console.error('Error creating user:', createError)
      return null
    }

    return newUser
  } catch (error) {
    console.error('Database error in getOrCreateUser:', error)
    return null
  }
}

export async function getUserByClerkId(clerkId: string): Promise<User | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('clerk_id', clerkId)
      .single()

    if (error) {
      console.error('Error fetching user:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Database error in getUserByClerkId:', error)
    return null
  }
}

export async function getUserByStripeCustomerId(customerId: string): Promise<User | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('stripe_customer_id', customerId)
      .single()

    if (error) {
      console.error('Error fetching user by Stripe ID:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Database error in getUserByStripeCustomerId:', error)
    return null
  }
}

// Subscription management functions
export async function updateUserSubscription(
  userId: number,
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
    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)

    if (error) {
      console.error('Error updating subscription:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Database error in updateUserSubscription:', error)
    return false
  }
}

// Token usage functions
export async function incrementTokenUsage(
  userId: number,
  tokensUsed: number,
  model?: string,
  requestType: 'chat' | 'image' = 'chat'
): Promise<boolean> {
  try {
    // Start a transaction to update usage and log it
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('tokens_used, tokens_limit')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      console.error('Error fetching user for token update:', userError)
      return false
    }

    const newTokensUsed = user.tokens_used + tokensUsed

    // Update user's token count
    const { error: updateError } = await supabase
      .from('users')
      .update({ tokens_used: newTokensUsed })
      .eq('id', userId)

    if (updateError) {
      console.error('Error updating token usage:', updateError)
      return false
    }

    // Log the usage
    const { error: logError } = await supabase.from('usage_logs').insert([
      {
        user_id: userId,
        tokens_used: tokensUsed,
        model: model,
        request_type: requestType,
      },
    ])

    if (logError) {
      console.error('Error logging usage:', logError)
      // Don't fail the operation if logging fails
    }

    return true
  } catch (error) {
    console.error('Database error in incrementTokenUsage:', error)
    return false
  }
}

export async function resetMonthlyUsage(userId: number): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('users')
      .update({ tokens_used: 0 })
      .eq('id', userId)

    if (error) {
      console.error('Error resetting usage:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Database error in resetMonthlyUsage:', error)
    return false
  }
}

export async function checkTokenLimit(userId: number): Promise<{
  allowed: boolean
  used: number
  limit: number
  remaining: number
}> {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('tokens_used, tokens_limit, subscription_tier')
      .eq('id', userId)
      .single()

    if (error || !user) {
      console.error('Error checking token limit:', error)
      return { allowed: false, used: 0, limit: 0, remaining: 0 }
    }

    const remaining = user.tokens_limit - user.tokens_used
    const allowed = remaining > 0

    return {
      allowed,
      used: user.tokens_used,
      limit: user.tokens_limit,
      remaining: Math.max(0, remaining),
    }
  } catch (error) {
    console.error('Database error in checkTokenLimit:', error)
    return { allowed: false, used: 0, limit: 0, remaining: 0 }
  }
}

// Subscription history logging
export async function logSubscriptionEvent(
  userId: number,
  eventType: string,
  tier?: string,
  status?: string,
  stripeEventId?: string,
  metadata?: any
): Promise<void> {
  try {
    const { error } = await supabase.from('subscription_history').insert([
      {
        user_id: userId,
        event_type: eventType,
        tier,
        status,
        stripe_event_id: stripeEventId,
        metadata,
      },
    ])

    if (error) {
      console.error('Error logging subscription event:', error)
    }
  } catch (error) {
    console.error('Database error in logSubscriptionEvent:', error)
  }
}

// Get usage statistics
export async function getUserUsageStats(
  userId: number,
  startDate?: Date,
  endDate?: Date
): Promise<{
  totalTokens: number
  chatTokens: number
  imageTokens: number
  requestCount: number
} | null> {
  try {
    let query = supabase
      .from('usage_logs')
      .select('tokens_used, request_type')
      .eq('user_id', userId)

    if (startDate) {
      query = query.gte('created_at', startDate.toISOString())
    }

    if (endDate) {
      query = query.lte('created_at', endDate.toISOString())
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching usage stats:', error)
      return null
    }

    const stats = {
      totalTokens: 0,
      chatTokens: 0,
      imageTokens: 0,
      requestCount: data?.length || 0,
    }

    data?.forEach((log) => {
      stats.totalTokens += log.tokens_used
      if (log.request_type === 'chat') {
        stats.chatTokens += log.tokens_used
      } else if (log.request_type === 'image') {
        stats.imageTokens += log.tokens_used
      }
    })

    return stats
  } catch (error) {
    console.error('Database error in getUserUsageStats:', error)
    return null
  }
}