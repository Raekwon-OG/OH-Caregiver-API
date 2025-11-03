"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const http_1 = __importDefault(require("http"));
const app_1 = require("./app");
const database_1 = require("./config/database");
const logger_1 = require("./utils/logger");
const socket_1 = require("./utils/socket");
const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/oh-caregiver';
async function start() {
    await (0, database_1.connectDatabase)(MONGODB_URI);
    const app = await (0, app_1.createApp)();
    const server = http_1.default.createServer(app);
    (0, socket_1.initSocket)(server);
    server.listen(PORT, () => {
        logger_1.logger.info(`Server listening on port ${PORT}`);
    });
}
start().catch((err) => {
    logger_1.logger.error('Failed to start', { err });
    process.exit(1);
});
