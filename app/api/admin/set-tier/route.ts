import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { sql } from '@/lib/database/postgres-client'

const ADMIN_EMAILS = ['tannercarlson@vvsvault.com']

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentUser = await (await clerkClient()).users.getUser(userId)
    const userEmail = currentUser.emailAddresses[0]?.emailAddress

    if (!ADMIN_EMAILS.includes(userEmail || '')) {
      return NextResponse.json({ error: 'Forbidden - Admin access only' }, { status: 403 })
    }

    const { targetUserId, targetEmail, tier } = await request.json()

    if (!tier || !['free', 'starter', 'premium', 'limitless', 'trial'].includes(tier)) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
    }

    // Find user by email if provided, otherwise use targetUserId
    let userToUpdate = targetUserId

    if (targetEmail && !targetUserId) {
      const result = await sql`
        SELECT user_id FROM users_subscription
        WHERE user_id IN (
          SELECT user_id FROM users_subscription
        )
        LIMIT 1
      `
      // Note: We can't query Clerk from here easily, so targetUserId is preferred
      if (!result.rows[0]) {
        return NextResponse.json({ error: 'User not found. Please provide targetUserId.' }, { status: 404 })
      }
    }

    if (!userToUpdate) {
      return NextResponse.json({ error: 'targetUserId is required' }, { status: 400 })
    }

    const now = new Date()
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    // Upsert the subscription
    await sql`
      INSERT INTO users_subscription (
        user_id, tier, status, current_period_start, current_period_end
      ) VALUES (
        ${userToUpdate}, ${tier}, 'active', ${now.toISOString()}, ${periodEnd.toISOString()}
      )
      ON CONFLICT (user_id) DO UPDATE SET
        tier = ${tier},
        status = 'active',
        current_period_start = ${now.toISOString()},
        current_period_end = ${periodEnd.toISOString()},
        updated_at = CURRENT_TIMESTAMP
    `

    // Clear their usage cache so it recalculates with new tier limits
    await sql`
      DELETE FROM monthly_usage_cache WHERE user_id = ${userToUpdate}
    `

    // Also reset their token usage for fresh start (optional - remove if you want to keep history)
    await sql`
      DELETE FROM token_usage WHERE user_id = ${userToUpdate}
    `

    return NextResponse.json({
      success: true,
      message: `User ${userToUpdate} set to ${tier} tier`,
      subscription: {
        userId: userToUpdate,
        tier,
        status: 'active',
        periodStart: now,
        periodEnd
      }
    })
  } catch (error) {
    console.error('Error setting tier:', error)
    return NextResponse.json({ error: 'Failed to set tier' }, { status: 500 })
  }
}
