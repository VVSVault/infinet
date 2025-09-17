import { Pool } from 'pg'

// Parse the connection string and add SSL params
let connectionString = process.env.POSTGRES_URL || ''

// Check if we're using a pooler connection (port 6543) or direct connection (port 5432)
const isPoolerConnection = connectionString.includes(':6543')

// For pooler connections, remove any SSL parameters from the connection string
// These can override our ssl: false setting
if (isPoolerConnection) {
  // Remove any SSL-related query parameters
  const url = new URL(connectionString)
  url.searchParams.delete('sslmode')
  url.searchParams.delete('ssl')
  url.searchParams.delete('sslcert')
  url.searchParams.delete('sslkey')
  url.searchParams.delete('sslrootcert')
  url.searchParams.delete('supa')
  connectionString = url.toString()

  console.log('[Database] Pooler connection detected - SSL disabled')
  console.log('[Database] Connection string (SSL params removed):', connectionString.substring(0, 50) + '...')
}

// Log connection type for debugging
console.log('[Database] Connection type:', isPoolerConnection ? 'Pooler (6543)' : 'Direct (5432)',
  'Environment:', process.env.NODE_ENV || 'development')

// Create a connection pool
// Pooler connections (port 6543) don't use SSL - PgBouncer handles that
// Direct connections (port 5432) need SSL in production
const pool = new Pool({
  connectionString: connectionString,
  ssl: isPoolerConnection
    ? undefined // Explicitly undefined for pooler connections - no SSL at all
    : process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false } // SSL for production direct connections
    : false, // No SSL for local development
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

// Helper function to execute queries
export async function query<T = any>(text: string, params?: any[]): Promise<{ rows: T[], rowCount: number | null }> {
  try {
    const result = await pool.query(text, params)
    return {
      rows: result.rows,
      rowCount: result.rowCount
    }
  } catch (error) {
    console.error('Database query error:', error)
    throw error
  }
}

// Template literal tag for SQL queries (similar to @vercel/postgres)
export function sql<T = any>(
  strings: TemplateStringsArray,
  ...values: any[]
): Promise<{ rows: T[], rowCount: number | null }> {
  // Build the query string with placeholders
  let queryText = strings[0]
  const queryParams: any[] = []

  for (let i = 0; i < values.length; i++) {
    queryParams.push(values[i])
    queryText += `$${i + 1}${strings[i + 1]}`
  }

  return query<T>(queryText, queryParams)
}

// Export pool for advanced usage
export { pool }

// Cleanup function
export async function closePool() {
  await pool.end()
}