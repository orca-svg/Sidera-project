import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

const CreateProjectSchema = z.object({
  title: z.string().min(1),
  ownerId: z.string().uuid().optional(), // In MVP, maybe pass from client or auth header
})

const projectRoutes: FastifyPluginAsync = async (server) => {
  // GET /projects
  server.get('/', async (request, _reply) => {
    const { query } = request.query as { query?: string, sort?: string }

    const where = query ? {
      title: { contains: query, mode: 'insensitive' as const }
    } : {}

    const projects = await server.prisma.project.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 20
    })

    return projects
  })

  // POST /projects
  server.post('/', async (request, _reply) => {
    const body = CreateProjectSchema.parse(request.body)

    // Fallback owner if not provided (should come from Auth in real app)
    const ownerId = body.ownerId || 'guest-default'

    const project = await server.prisma.project.create({
      data: {
        title: body.title,
        ownerId
      }
    })

    return project
  })

  // GET /projects/:id
  server.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const project = await server.prisma.project.findUnique({
      where: { id },
      include: {
        turns: {
          where: { isReplaced: false } // Default: Hide replaced
        },
        edges: true
      }
    })

    if (!project) {
      return reply.status(404).send({ error: 'Project not found' })
    }

    return project
  })

  // DELETE /projects/:id
  server.delete('/:id', async (request, _reply) => {
    const { id } = request.params as { id: string }

    // Soft Delete or Hard Delete? MVP says "replace" policy for Turns. 
    // For Projects, soft delete usually.
    // But for MVP simplicity, let's hard delete or just ignore.
    // Let's implement Hard Delete for cleanup convenience during dev.
    await server.prisma.edge.deleteMany({ where: { projectId: id } })
    await server.prisma.turn.deleteMany({ where: { projectId: id } })
    await server.prisma.snapshot.deleteMany({ where: { projectId: id } })
    await server.prisma.project.delete({ where: { id } })

    return { success: true }
  })

  // POST /projects/:id/snapshots
  server.post('/:id/snapshots', async (request, _reply) => {
    const { id } = request.params as { id: string }

    const project = await server.prisma.project.findUnique({
      where: { id },
      include: {
        turns: {
          where: { isReplaced: false }
        },
        edges: true
      }
    })

    if (!project) {
      return _reply.status(404).send({ error: 'Project not found' })
    }

    // Create a new snapshot
    const snapshot = await server.prisma.snapshot.create({
      data: {
        projectId: id,
        title: `Snapshot - ${new Date().toISOString()}`,
        graphJson: {
          turns: project.turns,
          edges: project.edges
        }
      }
    })

    return snapshot
  })

  // GET /projects/:id/export
  server.get('/:id/export', async (request, reply) => {
    const { id } = request.params as { id: string }

    const project = await server.prisma.project.findUnique({
      where: { id },
      include: {
        turns: true, // Export ALL turns including replaced
        edges: true,
        snapshots: true
      }
    })

    if (!project) return reply.status(404).send({ error: 'Project not found' })

    return project;
  })
}

export { projectRoutes }
