const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' })

async function setupSupabase() {
  try {
    console.log('Setting up Supabase database...\n')

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Missing Supabase environment variables!')
      console.log('\nPlease add these to your .env.local file:')
      console.log('NEXT_PUBLIC_SUPABASE_URL=your_project_url')
      console.log('SUPABASE_SERVICE_ROLE_KEY=your_service_role_key')
      console.log('\nYou can find these in your Supabase project settings.')
      process.exit(1)
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    // Read the SQL file
    const sqlFile = fs.readFileSync(
      path.join(__dirname, 'setup-supabase.sql'),
      'utf8'
    )

    // Split by semicolon but preserve semicolons within quotes
    const statements = sqlFile
      .split(/;(?=(?:[^']*'[^']*')*[^']*$)/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    console.log(`Executing ${statements.length} SQL statements...`)

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (statement.length > 0) {
        console.log(`\n[${i + 1}/${statements.length}] Executing: ${statement.substring(0, 50)}...`)

        const { error } = await supabase.rpc('exec_sql', {
          sql_query: statement + ';'
        }).catch(async (err) => {
          // If RPC doesn't exist, try direct query
          const { data, error } = await supabase
            .from('_sql')
            .insert({ query: statement + ';' })
            .select()

          if (error) {
            // Fallback to manual execution notice
            return { error: { message: 'Please execute SQL manually in Supabase dashboard' } }
          }
          return { data, error: null }
        })

        if (error) {
          if (error.message.includes('already exists')) {
            console.log(`   ✓ Already exists, skipping...`)
          } else if (error.message.includes('manually')) {
            console.log('\n⚠️  Direct SQL execution not available.')
            console.log('\nPlease run the SQL manually:')
            console.log('1. Go to your Supabase dashboard')
            console.log('2. Navigate to SQL Editor')
            console.log('3. Copy the contents of scripts/setup-supabase.sql')
            console.log('4. Run the query')
            process.exit(0)
          } else {
            console.error(`   ❌ Error: ${error.message}`)
          }
        } else {
          console.log(`   ✓ Success`)
        }
      }
    }

    console.log('\n✅ Attempting to verify tables...')

    // Test the connection by checking tables
    const { data: usersCount, error: usersError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })

    const { data: logsCount, error: logsError } = await supabase
      .from('usage_logs')
      .select('*', { count: 'exact', head: true })

    const { data: historyCount, error: historyError } = await supabase
      .from('subscription_history')
      .select('*', { count: 'exact', head: true })

    if (!usersError && !logsError && !historyError) {
      console.log('\n📋 Tables verified:')
      console.log('   ✓ users table')
      console.log('   ✓ usage_logs table')
      console.log('   ✓ subscription_history table')
      console.log('\n✅ Database setup complete!')
    } else {
      console.log('\n⚠️  Could not verify all tables.')
      console.log('Please check your Supabase dashboard to ensure tables were created.')
      if (usersError) console.log(`Users table: ${usersError.message}`)
      if (logsError) console.log(`Logs table: ${logsError.message}`)
      if (historyError) console.log(`History table: ${historyError.message}`)
    }

  } catch (error) {
    console.error('Error setting up database:', error)
    process.exit(1)
  }
}

setupSupabase()