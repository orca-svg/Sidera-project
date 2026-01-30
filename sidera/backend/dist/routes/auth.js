"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = void 0;
const crypto_1 = require("crypto");
const authRoutes = async (server) => {
    server.post('/guest', async (_request, _reply) => {
        const guestId = (0, crypto_1.randomUUID)();
        const token = `guest-${guestId}`;
        return { guestId, token };
    });
};
exports.authRoutes = authRoutes;
//# sourceMappingURL=auth.js.map