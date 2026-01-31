import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

const CreateSnapshotSchema = z.object({
  title: z.string(),
  graphJson: z.any() // JSON object
})

const snapshotRoutes: FastifyPluginAsync = async (server) => {

  // POST /projects/:id/snapshots
  server.post('/projects/:id/snapshots', async (request, _reply) => {
    const { id: projectId } = request.params as { id: string }
    const body = CreateSnapshotSchema.parse(request.body)

    const snapshot = await server.prisma.snapshot.create({
      data: {
        projectId,
        title: body.title,
        graphJson: body.graphJson
      }
    })

    return snapshot
  })

  // GET /projects/:id/snapshots
  server.get('/projects/:id/snapshots', async (request, _reply) => {
    const { id: projectId } = request.params as { id: string }

    const snapshots = await server.prisma.snapshot.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' }
    })

    return snapshots
  })

  // GET /snapshots/:id
  server.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const snapshot = await server.prisma.snapshot.findUnique({ where: { id } })

    if (!snapshot) return reply.status(404).send({ error: 'Snapshot not found' })
    return snapshot
  })
}

export { snapshotRoutes }
