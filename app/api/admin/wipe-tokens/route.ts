import { NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { sql } from '@/lib/database/postgres-client'

const ADMIN_EMAILS = ['tannercarlson@vvsvault.com', 'tannerscarlson@gmail.com']

export async function POST() {
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

    // Get stats before wipe
    const beforeStats = await sql`
      SELECT COUNT(*) as total_records, SUM(tokens_used) as total_tokens
      FROM token_usage
    `

    // Wipe all token usage data
    await sql`DELETE FROM token_usage`

    // Clear the monthly usage cache
    await sql`DELETE FROM monthly_usage_cache`

    return NextResponse.json({
      success: true,
      message: 'All token usage data wiped',
      wiped: {
        records: beforeStats.rows[0]?.total_records || 0,
        totalTokens: beforeStats.rows[0]?.total_tokens || 0
      }
    })
  } catch (error) {
    console.error('Error wiping token data:', error)
    return NextResponse.json({ error: 'Failed to wipe token data' }, { status: 500 })
  }
}
