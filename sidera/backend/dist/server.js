"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const app_1 = require("./app");
dotenv_1.default.config();
const start = async () => {
    const app = await (0, app_1.buildApp)();
    const PORT = process.env.PORT || 3001;
    try {
        await app.listen({ port: Number(PORT), host: '0.0.0.0' });
        console.log(`Server listening at http://localhost:${PORT}`);
    }
    catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};
start();
//# sourceMappingURL=server.js.map