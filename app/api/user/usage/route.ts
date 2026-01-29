import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getUserSubscription, getMonthlyUsage } from '@/lib/database/db'

const DEVELOPER_EMAILS = ['tannercarlson@vvsvault.com', 'tannerscarlson@gmail.com']

function getTokenLimit(tier: string): number {
  switch (tier) {
    case 'free': return 500
    case 'starter': return 10000
    case 'premium': return 50000
    case 'limitless': return 100000
    case 'trial': return 1000
    case 'developer': return Infinity
    default: return 500
  }
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const subscription = await getUserSubscription(userId)
    const usage = await getMonthlyUsage(userId)

    const tier = subscription?.tier || 'free'
    const tokenLimit = getTokenLimit(tier)
    const tokensUsed = usage?.total_tokens || 0
    const tokensRemaining = Math.max(0, tokenLimit - tokensUsed)
    const percentUsed = tokenLimit === Infinity ? 0 : Math.round((tokensUsed / tokenLimit) * 100)

    return NextResponse.json({
      subscription: {
        tier,
        status: subscription?.status || 'active',
        periodStart: subscription?.current_period_start,
        periodEnd: subscription?.current_period_end,
      },
      usage: {
        tokensUsed,
        tokenLimit: tokenLimit === Infinity ? 'unlimited' : tokenLimit,
        tokensRemaining: tokenLimit === Infinity ? 'unlimited' : tokensRemaining,
        percentUsed,
        totalRequests: usage?.total_requests || 0,
      }
    })
  } catch (error) {
    console.error('Error fetching user usage:', error)
    return NextResponse.json({ error: 'Failed to fetch usage' }, { status: 500 })
  }
}
