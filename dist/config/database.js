"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDatabase = connectDatabase;
const mongoose_1 = __importDefault(require("mongoose"));
const logger_1 = require("../utils/logger");
async function connectDatabase(uri) {
    try {
        await mongoose_1.default.connect(uri, {
        // useNewUrlParser, useUnifiedTopology are defaults in Mongoose 6+
        });
        logger_1.logger.info('Connected to MongoDB');
    }
    catch (err) {
        logger_1.logger.error('MongoDB connection error', { err });
        throw err;
    }
}
