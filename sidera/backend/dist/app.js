"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildApp = buildApp;
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const prisma_1 = __importDefault(require("./plugins/prisma"));
const projects_1 = require("./routes/projects");
const turns_1 = require("./routes/turns");
const snapshots_1 = require("./routes/snapshots");
const auth_1 = require("./routes/auth");
async function buildApp() {
    const app = (0, fastify_1.default)({ logger: true });
    await app.register(cors_1.default, {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
    });
    await app.register(prisma_1.default);
    await app.register(auth_1.authRoutes, { prefix: '/auth' });
    await app.register(projects_1.projectRoutes, { prefix: '/projects' });
    await app.register(turns_1.turnRoutes, { prefix: '/api' });
    await app.register(snapshots_1.snapshotRoutes, { prefix: '/snapshots' });
    app.setErrorHandler((error, _request, reply) => {
        app.log.error(error);
        reply.status(500).send({ error: 'Internal Server Error', message: error.message });
    });
    return app;
}
//# sourceMappingURL=app.js.map