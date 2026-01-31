"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.snapshotRoutes = void 0;
const zod_1 = require("zod");
const CreateSnapshotSchema = zod_1.z.object({
    title: zod_1.z.string(),
    graphJson: zod_1.z.any()
});
const snapshotRoutes = async (server) => {
    server.post('/projects/:id/snapshots', async (request, _reply) => {
        const { id: projectId } = request.params;
        const body = CreateSnapshotSchema.parse(request.body);
        const snapshot = await server.prisma.snapshot.create({
            data: {
                projectId,
                title: body.title,
                graphJson: body.graphJson
            }
        });
        return snapshot;
    });
    server.get('/projects/:id/snapshots', async (request, _reply) => {
        const { id: projectId } = request.params;
        const snapshots = await server.prisma.snapshot.findMany({
            where: { projectId },
            orderBy: { createdAt: 'desc' }
        });
        return snapshots;
    });
    server.get('/:id', async (request, reply) => {
        const { id } = request.params;
        const snapshot = await server.prisma.snapshot.findUnique({ where: { id } });
        if (!snapshot)
            return reply.status(404).send({ error: 'Snapshot not found' });
        return snapshot;
    });
};
exports.snapshotRoutes = snapshotRoutes;
//# sourceMappingURL=snapshots.js.map