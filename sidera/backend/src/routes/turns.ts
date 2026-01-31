import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { generateCoordinates } from '../lib/coordinates'
import { TurnStatus, StarType, EdgeType } from '@prisma/client'

const CreateTurnSchema = z.object({
  parentTurnId: z.string().uuid().optional().nullable(),
  userText: z.string(),
  projectId: z.string().uuid()
})

const UpdateTurnSchema = z.object({
  pinned: z.boolean().optional(),
  summary: z.string().optional(),
  isReplaced: z.boolean().optional(),
  replacedReason: z.string().optional()
})

const turnRoutes: FastifyPluginAsync = async (server) => {

  // POST /projects/:id/turns
  server.post('/projects/:id/turns', async (request, reply) => {
    const { id: projectId } = request.params as { id: string }
    const body = CreateTurnSchema.parse({ ...request.body as any, projectId })

    // 1. Get Parent
    let parentTurn = null
    let childIndex = 0

    if (body.parentTurnId) {
      parentTurn = await server.prisma.turn.findUnique({ where: { id: body.parentTurnId } })
      if (!parentTurn) return reply.status(404).send({ error: 'Parent turn not found' })

      childIndex = await server.prisma.turn.count({ where: { parentTurnId: body.parentTurnId } })
    } else {
      childIndex = await server.prisma.turn.count({ where: { projectId, parentTurnId: null } })
    }

    // 2. Coords
    const coords = generateCoordinates(projectId, parentTurn, childIndex)

    // 3. Create Turn
    const turn = await server.prisma.turn.create({
      data: {
        projectId,
        parentTurnId: body.parentTurnId,
        roleUserText: body.userText,
        roleAiText: "",
        status: TurnStatus.STREAMING,
        x: coords.x,
        y: coords.y,
        z: coords.z,
        starType: StarType.BETA,
      }
    })

    // 4. Edge
    if (body.parentTurnId) {
      await server.prisma.edge.create({
        data: {
          projectId,
          fromTurnId: body.parentTurnId,
          toTurnId: turn.id,
          type: EdgeType.SOLID
        }
      })
    }

    return turn;
  })

  // SSE Stream
  server.get('/turns/:id/stream', async (request, reply) => {
    const { id } = request.params as { id: string }

    const turn = await server.prisma.turn.findUnique({ where: { id } })
    if (!turn) {
      reply.raw.statusCode = 404
      reply.raw.end()
      return
    }

    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('Connection', 'keep-alive')
    reply.raw.flushHeaders()

    const mockResponse = `This is a simulated response for the node at (${turn.x.toFixed(2)}, ${turn.y.toFixed(2)}). Context: ${turn.roleUserText}`;
    const tokens = mockResponse.split(/(.{4})/g).filter(Boolean);

    let index = 0
    const interval = setInterval(async () => {
      if (index >= tokens.length) {
        clearInterval(interval)

        let finalType: StarType = StarType.BETA;
        if (mockResponse.length < 20 || ["ok", "yes", "confirm"].some(w => mockResponse.toLowerCase().includes(w))) {
          finalType = StarType.SATELLITE
        }

        await server.prisma.turn.update({
          where: { id },
          data: {
            status: TurnStatus.DONE,
            roleAiText: mockResponse,
            starType: finalType
          }
        })

        reply.raw.write(`event: finalize\ndata: ${JSON.stringify({ fullText: mockResponse, type: finalType })}\n\n`)
        reply.raw.end()
        return
      }

      const chunk = tokens[index]
      reply.raw.write(`event: message\ndata: ${JSON.stringify({ chunk })}\n\n`)
      index++
    }, 100)

    request.raw.on('close', () => {
      clearInterval(interval)
    })
  })

  // PATCH
  server.patch('/turns/:id', async (request, _reply) => {
    const { id } = request.params as { id: string }
    const body = UpdateTurnSchema.parse(request.body)

    const updated = await server.prisma.turn.update({
      where: { id },
      data: {
        pinned: body.pinned,
        summary: body.summary,
        isReplaced: body.isReplaced,
        replacedReason: body.replacedReason,
        starType: body.pinned ? StarType.ALPHA : undefined
      }
    })

    return updated
  })
}

export { turnRoutes }
