import { Context } from 'hono'
import migrateService from '../service/migrateService'

async function migrate(c: Context) {
  const count = await migrateService.migrate()
  return c.json({ success: true, count })
}

async function status(c: Context) {
  const version = await migrateService.getCurrentVersion()
  return c.json({ currentVersion: version })
}

export { migrate, status }
