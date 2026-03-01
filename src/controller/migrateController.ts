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

async function list(c: Context) {
  const migrations = await migrateService.getAppliedMigrations()

  // 从文件名提取版本号并添加到响应中
  const migrationsWithVersion = migrations.map((m: any) => ({
    ...m,
    version: parseInt(m.name.match(/(\d{4})\.sql$/)?.[1] || '0', 10)
  }))

  return c.json({ migrations: migrationsWithVersion })
}

export { migrate, status, list }
