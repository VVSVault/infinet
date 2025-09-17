const { sql } = require('@vercel/postgres');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function setupDatabase() {
  try {
    console.log('Setting up Vercel Postgres database...\n');

    // Read the SQL file
    const sqlFile = fs.readFileSync(path.join(__dirname, 'setup-database.sql'), 'utf8');
    const statements = sqlFile
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    // Execute each statement
    for (const statement of statements) {
      if (statement.length > 0) {
        console.log(`Executing: ${statement.substring(0, 50)}...`);
        await sql.query(statement + ';');
      }
    }

    console.log('\n✅ Database schema created successfully!');

    // Test the connection by checking tables
    const tablesResult = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;

    console.log('\n📋 Created tables:');
    tablesResult.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });

    console.log('\n✅ Database setup complete!');

  } catch (error) {
    console.error('Error setting up database:', error);

    if (error.message && error.message.includes('POSTGRES_URL')) {
      console.log('\n⚠️  Database connection not configured.');
      console.log('Please follow these steps:\n');
      console.log('1. Go to your Vercel dashboard: https://vercel.com/dashboard');
      console.log('2. Select your "infinet" project');
      console.log('3. Go to the "Storage" tab');
      console.log('4. Click "Create Database" and select "Postgres"');
      console.log('5. Follow the setup wizard');
      console.log('6. Once created, run: vercel env pull .env.local');
      console.log('7. Then run this script again: node scripts/setup-database.js');
    }

    process.exit(1);
  }
}

setupDatabase();