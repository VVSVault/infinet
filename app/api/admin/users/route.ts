import { NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { getDb } from '@/lib/database/db'

export async function GET() {
  try {
    // Check if user is authenticated
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // For now, we'll allow any authenticated user to view this
    // In production, you should check if the user is an admin
    // You could check for a specific email or user ID
    const adminEmails = ['tannercarlson@vvsvault.com'] // Add your admin emails here

    // Get current user to check if they're an admin
    const currentUser = await (await clerkClient()).users.getUser(userId)
    const userEmail = currentUser.emailAddresses[0]?.emailAddress

    if (!adminEmails.includes(userEmail || '')) {
      return NextResponse.json({ error: 'Forbidden - Admin access only' }, { status: 403 })
    }

    // Fetch all users from Clerk
    const clerkUsers = await (await clerkClient()).users.getUserList({
      limit: 100,
      orderBy: '-created_at'
    })

    // Get database connection
    const db = await getDb()

    // Fetch subscription data for all users
    const userIds = clerkUsers.data.map(user => user.id)
    const subscriptions = await db.query(
      `SELECT * FROM users_subscription WHERE user_id = ANY($1::text[])`,
      [userIds]
    )

    // Fetch usage data for all users
    const usageData = await db.query(
      `SELECT
        user_id,
        COUNT(*) as total_requests,
        SUM(tokens_used) as total_tokens,
        MAX(timestamp) as last_activity
      FROM token_usage
      WHERE user_id = ANY($1::text[])
      GROUP BY user_id`,
      [userIds]
    )

    // Create a map of usage data by user_id
    const usageMap = new Map()
    usageData.rows.forEach(row => {
      usageMap.set(row.user_id, {
        totalRequests: parseInt(row.total_requests),
        totalTokens: parseInt(row.total_tokens || 0),
        lastActivity: row.last_activity
      })
    })

    // Create a map of subscription data by user_id
    const subscriptionMap = new Map()
    subscriptions.rows.forEach(row => {
      subscriptionMap.set(row.user_id, row)
    })

    // Combine Clerk user data with database data
    const enrichedUsers = clerkUsers.data.map(user => {
      const subscription = subscriptionMap.get(user.id)
      const usage = usageMap.get(user.id)

      return {
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress || 'No email',
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'No name',
        createdAt: user.createdAt,
        lastSignInAt: user.lastSignInAt,
        imageUrl: user.imageUrl,
        subscription: {
          tier: subscription?.tier || 'free',
          status: subscription?.status || 'active',
          currentPeriodEnd: subscription?.current_period_end
        },
        usage: {
          totalRequests: usage?.totalRequests || 0,
          totalTokens: usage?.totalTokens || 0,
          lastActivity: usage?.lastActivity || null
        }
      }
    })

    // Calculate statistics
    const stats = {
      totalUsers: enrichedUsers.length,
      activeUsers: enrichedUsers.filter(u => {
        const lastActive = u.usage.lastActivity || u.lastSignInAt
        if (!lastActive) return false
        const daysSinceActive = (Date.now() - new Date(lastActive).getTime()) / (1000 * 60 * 60 * 24)
        return daysSinceActive < 7 // Active in last 7 days
      }).length,
      paidUsers: enrichedUsers.filter(u => u.subscription.tier !== 'free').length,
      totalTokensUsed: enrichedUsers.reduce((sum, u) => sum + u.usage.totalTokens, 0)
    }

    return NextResponse.json({
      users: enrichedUsers,
      stats,
      totalCount: clerkUsers.totalCount
    })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}