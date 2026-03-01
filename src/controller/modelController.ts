import { Context } from 'hono'
import { SgModel } from '../model/sgModel'

const createModel = async (c: Context) => {
  const body = await c.req.json()
  const { name, vendor_id } = body

  const instance = await SgModel.query().create({
    name,
    vendor_id,
  })

  return c.json(instance)
}

const listModels = async (c: Context) => {
  const modelConfigs = await SgModel.query().get()
  return c.json(modelConfigs)
}

export { createModel, listModels }
