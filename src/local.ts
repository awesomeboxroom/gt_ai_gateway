import { sutando } from 'sutando'
import Database from 'better-sqlite3'
import { join } from 'path'
import { serve } from '@hono/node-server'
import { createApp } from './routes'
import { SQLiteAdapter, DatabaseAdapter } from './service/dbAdapter'

const DB_PATH = join(process.cwd(), 'local.db')

// 配置 Sutando 连接
sutando.addConnection({
  client: 'better-sqlite3',
  connection: {
    filename: DB_PATH,
  },
  useNullAsDefault: true,
})

// 创建数据库适配器
const db = new Database(DB_PATH)
const dbAdapter: DatabaseAdapter = new SQLiteAdapter(db)

const app = createApp({
  mode: 'local',
  dbAdapter: dbAdapter,
  middlewares: [
    async (c, next) => {
      c.set('dbAdapter', dbAdapter)
      await next()
    }
  ]
})

// 启动服务器
const port = parseInt(process.env.PORT || '3000', 10)
console.log(`Starting server on http://localhost:${port}`)

serve({
  fetch: app.fetch,
  port,
})
