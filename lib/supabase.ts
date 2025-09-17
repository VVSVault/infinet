import { createClient } from '@supabase/supabase-js'

// Create a single supabase client for interacting with your database
// Using service role key for server-side operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('Supabase environment variables not configured')
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

// Database types
export interface User {
  id: number
  clerk_id: string
  email: string
  stripe_customer_id?: string
  subscription_tier: 'free' | 'starter' | 'premium' | 'limitless'
  subscription_status: 'active' | 'inactive' | 'canceled' | 'past_due'
  stripe_subscription_id?: string
  tokens_used: number
  tokens_limit: number
  subscription_period_start?: Date
  subscription_period_end?: Date
  created_at: Date
  updated_at: Date
}

export interface UsageLog {
  id: number
  user_id: number
  tokens_used: number
  model?: string
  request_type: 'chat' | 'image'
  created_at: Date
}

export interface SubscriptionHistory {
  id: number
  user_id: number
  tier?: string
  status?: string
  event_type?: string
  stripe_event_id?: string
  metadata?: any
  created_at: Date
}