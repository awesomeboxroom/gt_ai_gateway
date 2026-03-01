import {Context, Next} from 'hono'
import ClientD1 from 'knex-cloudflare-d1';
import { sutando } from 'sutando';
import { createApp } from './routes'
import { D1Adapter, DatabaseAdapter } from './service/dbAdapter'

declare module 'hono' {
  interface ContextVariableMap {
  }
}

export interface Env {
  DB: D1Database;
}

// 在应用级别创建 adapter
const dbAdapter = new D1Adapter()

async function prepareDBConnection(c:Context, next:Next) {
  console.log("prepareDBConnection");

  // 初始化 adapter
  dbAdapter.setDB(c.env.DB)

  sutando.addConnection({
    client: ClientD1,
    connection: {
      database: c.env.DB
    },
    useNullAsDefault: true,
  });

  await next();
}

const app = createApp({
  mode: 'cloud',
  dbAdapter: dbAdapter,
  middlewares: [prepareDBConnection]
})

export default app
