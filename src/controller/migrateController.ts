import { Context } from 'hono'
import { DatabaseAdapter } from '../service/dbAdapter'

const migrate = (dbAdapter: DatabaseAdapter) => async (c: Context) => {
  const migrateService = await import('../service/migrateService')
  const count = await migrateService.migrate(dbAdapter)
  return c.json({ success: true, count })
}

const status = (dbAdapter: DatabaseAdapter) => async (c: Context) => {
  const migrateService = await import('../service/migrateService')
  const version = await migrateService.getCurrentVersion(dbAdapter)
  return c.json({ currentVersion: version })
}

export { migrate, status }
