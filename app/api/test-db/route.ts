import { sql } from '@/lib/database/postgres-client'
import { NextResponse } from 'next/server'

export async function GET() {
  const tests: any[] = []

  try {
    // Test 1: Check if we can connect at all
    tests.push({ test: 'Connection', status: 'testing' })

    // Log environment variables (safely)
    const envCheck = {
      POSTGRES_URL: process.env.POSTGRES_URL ? 'SET' : 'NOT SET',
      POSTGRES_URL_length: process.env.POSTGRES_URL?.length || 0,
      POSTGRES_URL_includes_aws0: process.env.POSTGRES_URL?.includes('aws-0') || false,
      POSTGRES_URL_includes_aws1: process.env.POSTGRES_URL?.includes('aws-1') || false,
      POSTGRES_URL_NON_POOLING: process.env.POSTGRES_URL_NON_POOLING ? 'SET' : 'NOT SET',
      POSTGRES_DATABASE: process.env.POSTGRES_DATABASE || 'NOT SET',
      POSTGRES_HOST: process.env.POSTGRES_HOST || 'NOT SET',
      POSTGRES_USER: process.env.POSTGRES_USER || 'NOT SET',
    }
    tests.push({ test: 'Environment Variables', status: 'checked', details: envCheck })

    // Test 2: Simple query
    try {
      const result = await sql`SELECT NOW() as current_time, version() as pg_version`
      tests.push({
        test: 'Simple Query',
        status: 'success',
        result: result.rows[0],
        rowCount: result.rowCount
      })
    } catch (error: any) {
      tests.push({
        test: 'Simple Query',
        status: 'failed',
        error: error.message,
        code: error.code,
        detail: error.detail
      })
    }

    // Test 3: Check if tables exist
    try {
      const tables = await sql`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `
      tests.push({
        test: 'List Tables',
        status: 'success',
        tables: tables.rows.map(r => r.table_name),
        count: tables.rowCount
      })
    } catch (error: any) {
      tests.push({
        test: 'List Tables',
        status: 'failed',
        error: error.message
      })
    }

    // Test 4: Check token_usage table specifically
    try {
      const tokenUsage = await sql`
        SELECT COUNT(*) as count FROM token_usage
      `
      tests.push({
        test: 'token_usage table',
        status: 'success',
        count: tokenUsage.rows[0].count
      })
    } catch (error: any) {
      tests.push({
        test: 'token_usage table',
        status: 'failed',
        error: error.message,
        hint: 'Table might not exist'
      })
    }

    // Test 5: Check users_subscription table
    try {
      const subs = await sql`
        SELECT COUNT(*) as count FROM users_subscription
      `
      tests.push({
        test: 'users_subscription table',
        status: 'success',
        count: subs.rows[0].count
      })
    } catch (error: any) {
      tests.push({
        test: 'users_subscription table',
        status: 'failed',
        error: error.message,
        hint: 'Table might not exist'
      })
    }

    // Test 6: Try to insert and delete a test record
    try {
      const testUserId = 'test_' + Date.now()

      // Insert
      await sql`
        INSERT INTO token_usage (
          user_id, tokens_used, timestamp, billing_period_start, billing_period_end
        ) VALUES (
          ${testUserId}, 100, NOW(), NOW(), NOW() + INTERVAL '30 days'
        )
      `

      // Verify insert
      const verify = await sql`
        SELECT * FROM token_usage WHERE user_id = ${testUserId}
      `

      // Delete
      await sql`
        DELETE FROM token_usage WHERE user_id = ${testUserId}
      `

      tests.push({
        test: 'Insert/Delete Test',
        status: 'success',
        inserted: (verify.rowCount || 0) > 0,
        deleted: true
      })
    } catch (error: any) {
      tests.push({
        test: 'Insert/Delete Test',
        status: 'failed',
        error: error.message
      })
    }

    // Test 7: Check connection pooler (skip for Supabase pooler)
    // pool_mode is a PgBouncer-specific command that doesn't work with direct PostgreSQL
    tests.push({
      test: 'Pooler Check',
      status: 'info',
      note: 'Using Supabase pooler connection on port 6543'
    })

    // Overall summary
    const failed = tests.filter(t => t.status === 'failed')
    const success = tests.filter(t => t.status === 'success')

    return NextResponse.json({
      summary: {
        total_tests: tests.length,
        successful: success.length,
        failed: failed.length,
        database_connected: failed.length === 0,
        critical_tables_exist: tests.find(t => t.test === 'token_usage table')?.status === 'success' &&
                              tests.find(t => t.test === 'users_subscription table')?.status === 'success'
      },
      tests,
      recommendation: failed.length > 0
        ? 'Database connection or tables have issues. Check the failed tests above.'
        : 'Database is working correctly!'
    })

  } catch (error: any) {
    return NextResponse.json({
      error: 'Fatal database error',
      message: error.message,
      code: error.code,
      tests
    }, { status: 500 })
  }
}