import { Context } from 'hono'

const welcome = (mode: 'cloud' | 'local') => (c: Context) => {
  const message = mode === 'cloud'
    ? 'Hello, welcome to serverless ai gateway!'
    : 'Hello, welcome to serverless ai gateway (local mode)!'
  return c.text(message)
}

const initDatabase = (mode: 'cloud' | 'local') => async (c: Context) => {
  if (mode === 'cloud') {
    return c.text('init database')
  }
  return c.json({ message: 'Database initialized' })
}

export { welcome, initDatabase }
