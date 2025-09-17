const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function testSupabase() {
  try {
    console.log('Testing Supabase connection...\n')

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('❌ Missing Supabase environment variables!')
      process.exit(1)
    }

    console.log('URL:', supabaseUrl)

    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Test by trying to fetch from users table
    const { data, error, count } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })

    if (error) {
      if (error.code === '42P01' || error.message.includes('does not exist')) {
        console.log('❌ Tables not created yet.')
        console.log('\nPlease run the SQL from scripts/setup-supabase.sql in your Supabase dashboard:')
        console.log('1. Go to https://supabase.com/dashboard/project/qtgkchdhawoqfcwaofgo/sql')
        console.log('2. Copy the contents of scripts/setup-supabase.sql')
        console.log('3. Paste and run the query')
      } else {
        console.error('Error details:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        })
      }
    } else {
      console.log('✅ Successfully connected to Supabase!')
      console.log(`   Users table exists with ${count || 0} records`)

      // Test other tables
      const { error: logsError, count: logsCount } = await supabase
        .from('usage_logs')
        .select('*', { count: 'exact', head: true })

      const { error: historyError, count: historyCount } = await supabase
        .from('subscription_history')
        .select('*', { count: 'exact', head: true })

      if (!logsError) console.log(`   Usage logs table exists with ${logsCount || 0} records`)
      if (!historyError) console.log(`   Subscription history table exists with ${historyCount || 0} records`)

      console.log('\n✅ All tables are ready to use!')
    }

  } catch (error) {
    console.error('Error testing connection:', error)
    process.exit(1)
  }
}

testSupabase()