// Tiny Postgres bootstrap for the example. If DATABASE_URL is set, use it.
// Otherwise spin a throwaway `postgres:16` container via the Docker CLI, wait
// for readiness, and return a stop() that removes it.
import { execSync, spawnSync } from 'node:child_process'
import pg from 'pg'

export interface PgHandle {
  connectionString: string
  stop: () => void
}

async function waitForReady(connectionString: string, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  // biome-ignore lint/suspicious/noEvolvingTypes: simple retry loop
  let lastErr
  while (Date.now() < deadline) {
    const client = new pg.Client({ connectionString })
    try {
      await client.connect()
      await client.query('SELECT 1')
      await client.end()
      return
    } catch (err) {
      lastErr = err
      await client.end().catch(() => {})
      await new Promise(r => setTimeout(r, 500))
    }
  }
  throw new Error(`Postgres not ready in time: ${lastErr}`)
}

export async function getPostgres(): Promise<PgHandle> {
  const fromEnv = process.env.DATABASE_URL
  if (fromEnv) {
    await waitForReady(fromEnv)
    return { connectionString: fromEnv, stop: () => {} }
  }

  // Pick a high port to avoid clashing with a local pg on 5432.
  const port = 5440 + Math.floor((Date.now() % 50))
  const name = `delphi-gov-pg-${port}`
  console.log(`  🐘 starting throwaway Postgres container ${name} on :${port} ...`)
  execSync(
    `docker run -d --rm --name ${name} -e POSTGRES_PASSWORD=delphi -e POSTGRES_DB=delphi -p ${port}:5432 postgres:16 -c fsync=off`,
    { stdio: 'ignore' },
  )
  const connectionString = `postgresql://postgres:delphi@localhost:${port}/delphi`
  const stop = () => {
    spawnSync('docker', ['rm', '-f', name], { stdio: 'ignore' })
  }
  try {
    await waitForReady(connectionString)
  } catch (err) {
    stop()
    throw err
  }
  return { connectionString, stop }
}
