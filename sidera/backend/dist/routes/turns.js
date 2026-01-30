"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.turnRoutes = void 0;
const zod_1 = require("zod");
const coordinates_1 = require("../lib/coordinates");
const client_1 = require("@prisma/client");
const CreateTurnSchema = zod_1.z.object({
    parentTurnId: zod_1.z.string().uuid().optional().nullable(),
    userText: zod_1.z.string(),
    projectId: zod_1.z.string().uuid()
});
const UpdateTurnSchema = zod_1.z.object({
    pinned: zod_1.z.boolean().optional(),
    summary: zod_1.z.string().optional(),
    isReplaced: zod_1.z.boolean().optional(),
    replacedReason: zod_1.z.string().optional()
});
const turnRoutes = async (server) => {
    server.post('/projects/:id/turns', async (request, reply) => {
        const { id: projectId } = request.params;
        const body = CreateTurnSchema.parse({ ...request.body, projectId });
        let parentTurn = null;
        let childIndex = 0;
        if (body.parentTurnId) {
            parentTurn = await server.prisma.turn.findUnique({ where: { id: body.parentTurnId } });
            if (!parentTurn)
                return reply.status(404).send({ error: 'Parent turn not found' });
            childIndex = await server.prisma.turn.count({ where: { parentTurnId: body.parentTurnId } });
        }
        else {
            childIndex = await server.prisma.turn.count({ where: { projectId, parentTurnId: null } });
        }
        const coords = (0, coordinates_1.generateCoordinates)(projectId, parentTurn, childIndex);
        const turn = await server.prisma.turn.create({
            data: {
                projectId,
                parentTurnId: body.parentTurnId,
                roleUserText: body.userText,
                roleAiText: "",
                status: client_1.TurnStatus.STREAMING,
                x: coords.x,
                y: coords.y,
                z: coords.z,
                starType: client_1.StarType.BETA,
            }
        });
        if (body.parentTurnId) {
            await server.prisma.edge.create({
                data: {
                    projectId,
                    fromTurnId: body.parentTurnId,
                    toTurnId: turn.id,
                    type: client_1.EdgeType.SOLID
                }
            });
        }
        return turn;
    });
    server.get('/turns/:id/stream', async (request, reply) => {
        const { id } = request.params;
        const turn = await server.prisma.turn.findUnique({ where: { id } });
        if (!turn) {
            reply.raw.statusCode = 404;
            reply.raw.end();
            return;
        }
        reply.raw.setHeader('Content-Type', 'text/event-stream');
        reply.raw.setHeader('Cache-Control', 'no-cache');
        reply.raw.setHeader('Connection', 'keep-alive');
        reply.raw.flushHeaders();
        const mockResponse = `This is a simulated response for the node at (${turn.x.toFixed(2)}, ${turn.y.toFixed(2)}). Context: ${turn.roleUserText}`;
        const tokens = mockResponse.split(/(.{4})/g).filter(Boolean);
        let index = 0;
        const interval = setInterval(async () => {
            if (index >= tokens.length) {
                clearInterval(interval);
                let finalType = client_1.StarType.BETA;
                if (mockResponse.length < 20 || ["ok", "yes", "confirm"].some(w => mockResponse.toLowerCase().includes(w))) {
                    finalType = client_1.StarType.SATELLITE;
                }
                await server.prisma.turn.update({
                    where: { id },
                    data: {
                        status: client_1.TurnStatus.DONE,
                        roleAiText: mockResponse,
                        starType: finalType
                    }
                });
                reply.raw.write(`event: finalize\ndata: ${JSON.stringify({ fullText: mockResponse, type: finalType })}\n\n`);
                reply.raw.end();
                return;
            }
            const chunk = tokens[index];
            reply.raw.write(`event: message\ndata: ${JSON.stringify({ chunk })}\n\n`);
            index++;
        }, 100);
        request.raw.on('close', () => {
            clearInterval(interval);
        });
    });
    server.patch('/turns/:id', async (request, _reply) => {
        const { id } = request.params;
        const body = UpdateTurnSchema.parse(request.body);
        const updated = await server.prisma.turn.update({
            where: { id },
            data: {
                pinned: body.pinned,
                summary: body.summary,
                isReplaced: body.isReplaced,
                replacedReason: body.replacedReason,
                starType: body.pinned ? client_1.StarType.ALPHA : undefined
            }
        });
        return updated;
    });
};
exports.turnRoutes = turnRoutes;
//# sourceMappingURL=turns.js.map