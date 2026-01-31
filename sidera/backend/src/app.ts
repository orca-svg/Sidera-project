import fastify, { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import prismaPlugin from './plugins/prisma'
import { projectRoutes } from './routes/projects'
import { turnRoutes } from './routes/turns'
import { snapshotRoutes } from './routes/snapshots'
import { authRoutes } from './routes/auth'

export async function buildApp(): Promise<FastifyInstance> {
  const app = fastify({ logger: true })

  // Plugins
  await app.register(cors, {
    origin: '*', // For MVP dev
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
  })
  await app.register(prismaPlugin)

  // Routes
  await app.register(authRoutes, { prefix: '/auth' })
  await app.register(projectRoutes, { prefix: '/projects' })
  await app.register(turnRoutes, { prefix: '/api' }) // Catch-all or specific?
  // Let's organize strictly:
  // turns are usually under projects, but we need direct access too.
  // "POST /projects/:id/turns" is in projectRoutes or turnRoutes?
  // Let's put logic in respective files.

  await app.register(snapshotRoutes, { prefix: '/snapshots' })

  // Global Error Handler
  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error)
    reply.status(500).send({ error: 'Internal Server Error', message: error.message })
  })

  return app
}
