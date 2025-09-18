import { NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { query } from '@/lib/database/postgres-client'

export async function POST() {
  try {
    // Check if user is authenticated and is admin
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminEmails = ['tannercarlson@vvsvault.com']
    const currentUser = await (await clerkClient()).users.getUser(userId)
    const userEmail = currentUser.emailAddresses[0]?.emailAddress

    if (!adminEmails.includes(userEmail || '')) {
      return NextResponse.json({ error: 'Forbidden - Admin access only' }, { status: 403 })
    }

    // Get current stats before fix
    const beforeStats = await query(`
      SELECT
        user_id,
        COUNT(*) as request_count,
        SUM(tokens_used) as total_tokens,
        AVG(tokens_used)::integer as avg_tokens
      FROM token_usage
      GROUP BY user_id
    `)

    // Fix 1: Cap free tier users' individual requests at 100 tokens
    const freeUsersFix = await query(`
      UPDATE token_usage
      SET tokens_used = LEAST(tokens_used, 100)
      WHERE user_id IN (
        SELECT user_id
        FROM users_subscription
        WHERE tier = 'free'
      )
      AND tokens_used > 100
      RETURNING user_id
    `)

    // Fix 2: Divide overcounted tokens (anything over 1000 tokens per request)
    const overCountFix = await query(`
      UPDATE token_usage
      SET tokens_used = ROUND(tokens_used / 10)
      WHERE tokens_used > 1000
      RETURNING user_id, tokens_used
    `)

    // Fix 3: Ensure reasonable averages (cap at 500 tokens per request max)
    const extremeFix = await query(`
      UPDATE token_usage
      SET tokens_used = LEAST(tokens_used, 500)
      WHERE tokens_used > 500
      RETURNING user_id
    `)

    // Get stats after fix
    const afterStats = await query(`
      SELECT
        user_id,
        COUNT(*) as request_count,
        SUM(tokens_used) as total_tokens,
        AVG(tokens_used)::integer as avg_tokens
      FROM token_usage
      GROUP BY user_id
    `)

    // Clear the monthly usage cache so it gets recalculated
    await query(`DELETE FROM monthly_usage_cache`)

    return NextResponse.json({
      message: 'Token counts fixed successfully',
      fixes: {
        freeUsersAffected: freeUsersFix.rowCount,
        overCountedFixed: overCountFix.rowCount,
        extremeValuesFixed: extremeFix.rowCount
      },
      before: {
        totalUsers: beforeStats.rows.length,
        avgTokensPerRequest: Math.round(
          beforeStats.rows.reduce((sum, r) => sum + r.avg_tokens, 0) / beforeStats.rows.length
        )
      },
      after: {
        totalUsers: afterStats.rows.length,
        avgTokensPerRequest: Math.round(
          afterStats.rows.reduce((sum, r) => sum + r.avg_tokens, 0) / afterStats.rows.length
        )
      }
    })
  } catch (error) {
    console.error('Error fixing token counts:', error)
    return NextResponse.json(
      { error: 'Failed to fix token counts' },
      { status: 500 }
    )
  }
}