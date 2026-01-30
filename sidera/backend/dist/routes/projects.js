"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectRoutes = void 0;
const zod_1 = require("zod");
const CreateProjectSchema = zod_1.z.object({
    title: zod_1.z.string().min(1),
    ownerId: zod_1.z.string().uuid().optional(),
});
const projectRoutes = async (server) => {
    server.get('/', async (request, _reply) => {
        const { query } = request.query;
        const where = query ? {
            title: { contains: query, mode: 'insensitive' }
        } : {};
        const projects = await server.prisma.project.findMany({
            where,
            orderBy: { updatedAt: 'desc' },
            take: 20
        });
        return projects;
    });
    server.post('/', async (request, _reply) => {
        const body = CreateProjectSchema.parse(request.body);
        const ownerId = body.ownerId || 'guest-default';
        const project = await server.prisma.project.create({
            data: {
                title: body.title,
                ownerId
            }
        });
        return project;
    });
    server.get('/:id', async (request, reply) => {
        const { id } = request.params;
        const project = await server.prisma.project.findUnique({
            where: { id },
            include: {
                turns: {
                    where: { isReplaced: false }
                },
                edges: true
            }
        });
        if (!project) {
            return reply.status(404).send({ error: 'Project not found' });
        }
        return project;
    });
    server.delete('/:id', async (request, _reply) => {
        const { id } = request.params;
        await server.prisma.edge.deleteMany({ where: { projectId: id } });
        await server.prisma.turn.deleteMany({ where: { projectId: id } });
        await server.prisma.snapshot.deleteMany({ where: { projectId: id } });
        await server.prisma.project.delete({ where: { id } });
        return { success: true };
    });
    server.post('/:id/snapshots', async (request, _reply) => {
        const { id } = request.params;
        const project = await server.prisma.project.findUnique({
            where: { id },
            include: {
                turns: {
                    where: { isReplaced: false }
                },
                edges: true
            }
        });
        if (!project) {
            return _reply.status(404).send({ error: 'Project not found' });
        }
        const snapshot = await server.prisma.snapshot.create({
            data: {
                projectId: id,
                title: `Snapshot - ${new Date().toISOString()}`,
                graphJson: {
                    turns: project.turns,
                    edges: project.edges
                }
            }
        });
        return snapshot;
    });
    server.get('/:id/export', async (request, reply) => {
        const { id } = request.params;
        const project = await server.prisma.project.findUnique({
            where: { id },
            include: {
                turns: true,
                edges: true,
                snapshots: true
            }
        });
        if (!project)
            return reply.status(404).send({ error: 'Project not found' });
        return project;
    });
};
exports.projectRoutes = projectRoutes;
//# sourceMappingURL=projects.js.map