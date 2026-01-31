import { FastifyPluginAsync } from 'fastify'
import { randomUUID } from 'crypto'

const authRoutes: FastifyPluginAsync = async (server) => {
  server.post('/guest', async (_request, _reply) => {
    // Determine Guest Logic
    // In MVP, we just generate a random ID and assume it's valid.
    // In real app, we might sign a JWT.

    const guestId = randomUUID();
    const token = `guest-${guestId}`; // Simple token for MVP

    return { guestId, token };
  })
}

export { authRoutes }
