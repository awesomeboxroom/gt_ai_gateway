import { readdirSync } from 'fs'
import { join } from 'path'
import { existsSync } from 'fs'
import { readFileSync } from 'fs'
import { DatabaseAdapter } from './dbAdapter'

const RESOURCE_DIR = join(process.cwd(), 'src/resource')

export interface Migration {
  name: string
  version: number
}

async function initMigrationsTable(dbAdapter: DatabaseAdapter) {
  await dbAdapter.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      version INTEGER NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
  `)
}

async function getAppliedMigrations(dbAdapter: DatabaseAdapter): Promise<Migration[]> {
  const result = await dbAdapter.prepare('SELECT name, version FROM _migrations ORDER BY version').all()
  if ('results' in result) {
    return result.results as Migration[]
  }
  return result as Migration[]
}

function getAvailableMigrations(): Migration[] {
  if (!existsSync(RESOURCE_DIR)) {
    return []
  }

  const files = readdirSync(RESOURCE_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort()

  return files.map((file, index) => ({
    name: file,
    version: index + 1
  }))
}

async function applyMigration(dbAdapter: DatabaseAdapter, migration: Migration) {
  const sqlPath = join(RESOURCE_DIR, migration.name)
  const sql = readFileSync(sqlPath, 'utf-8')

  // 执行迁移 SQL
  await dbAdapter.exec(sql)

  // 记录已应用的迁移
  await dbAdapter.prepare(
    'INSERT INTO _migrations (name, version) VALUES (?, ?)'
  ).run(migration.name, migration.version)

  console.log(`Applied migration: ${migration.name}`)
}

async function migrate(dbAdapter: DatabaseAdapter): Promise<number> {
  await initMigrationsTable(dbAdapter)

  const applied = await getAppliedMigrations(dbAdapter)
  const available = getAvailableMigrations()

  const appliedVersions = new Set(applied.map(m => m.version))
  const pendingMigrations = available.filter(m => !appliedVersions.has(m.version))

  if (pendingMigrations.length === 0) {
    console.log('Database is up to date')
    return 0
  }

  console.log(`Found ${pendingMigrations.length} pending migration(s)`)

  for (const migration of pendingMigrations) {
    await applyMigration(dbAdapter, migration)
  }

  return pendingMigrations.length
}

async function getCurrentVersion(dbAdapter: DatabaseAdapter): Promise<number> {
  const result = await dbAdapter.prepare('SELECT MAX(version) as max_version FROM _migrations').first()
  return result?.max_version || 0
}

export default {
  migrate,
  getCurrentVersion,
}
