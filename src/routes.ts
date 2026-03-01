import { Hono, MiddlewareHandler } from 'hono'
import { chatCompletions } from './controller/gatewayController'
import * as ModelController from './controller/modelController'
import * as UserController from './controller/userController'
import * as VendorController from './controller/vendorController'
import * as RecordController from './controller/recordController'
import * as MigrateController from './controller/migrateController'
import * as SystemController from './controller/systemController'
import { ormService } from './service/ormService'

interface Env {
  DB: D1Database;
}

const dbMiddleware: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  await ormService.prepareDBConnection(c.env?.DB)
  await next()
}

const app = new Hono<{ Bindings: Env }>()

// 注册数据库中间件
app.use('*', dbMiddleware)

// System
app.get('/', SystemController.welcome)

// Migration
app.post('/migrate', MigrateController.migrate)
app.get('/migrate/status', MigrateController.status)

// Model
app.post('/model/create.json', ModelController.createModel)
app.get('/model/list.json', ModelController.listModels)

// User
app.get('/user/list.json', UserController.listUsers)
app.get('/user/:id', UserController.getUser)
app.post('/user/create.json', UserController.createUser)

// Vendor
app.get('/vendor/list.json', VendorController.listVendors)
app.get('/vendor/:id', VendorController.getVendor)
app.post('/vendor/create.json', VendorController.createVendor)

// Record
app.get('/record/list.json', RecordController.listRecords)
app.get('/record/latest.json', RecordController.latestRecords)
app.get('/record/:id', RecordController.getRecord)

// AI
app.post('/v1/chat/completions', chatCompletions)

export { app, Env }
export default app
