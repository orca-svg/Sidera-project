import dotenv from 'dotenv'
import { buildApp } from './app'

dotenv.config()

const start = async () => {
  const app = await buildApp()
  const PORT = process.env.PORT || 3001

  try {
    await app.listen({ port: Number(PORT), host: '0.0.0.0' })
    console.log(`Server listening at http://localhost:${PORT}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
