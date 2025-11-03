"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const rateLimiters_1 = require("./middleware/rateLimiters");
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const openapi_json_1 = __importDefault(require("./docs/openapi.json"));
const body_parser_1 = require("body-parser");
const logger_1 = require("./utils/logger");
const jwks_1 = require("./utils/jwks");
const errorHandler_1 = require("./middleware/errorHandler");
const caregiverRoutes_1 = __importDefault(require("./routes/caregiverRoutes"));
const protectedMemberRoutes_1 = __importDefault(require("./routes/protectedMemberRoutes"));
const swaggerDocument = openapi_json_1.default;
async function createApp() {
    // Initialize JWKS early to pre-warm keys for RS256 verification
    try {
        (0, jwks_1.initJwks)(process.env.SUPABASE_URL);
        if (process.env.SUPABASE_URL) {
            const pre = await (0, jwks_1.prewarmJwks)();
            // Log only a non-sensitive summary so we don't leak JWKS endpoints or full error bodies.
            logger_1.logger.info('JWKS prewarm result', {
                ok: Boolean(pre?.ok),
                status: pre?.status ?? null,
                lastErrorAt: pre?.lastError?.at ?? null,
            });
        }
    }
    catch (err) {
        logger_1.logger.warn('JWKS initialization/prewarm failed', { err });
    }
    const app = (0, express_1.default)();
    app.use((0, helmet_1.default)());
    app.use((0, cors_1.default)());
    app.use((0, body_parser_1.json)());
    // Global rate limiter
    app.use(rateLimiters_1.globalLimiter);
    app.get('/health', (req, res) => res.json({ status: 'ok' }));
    // enhance health with JWKS status
    app.get('/health', async (req, res) => {
        try {
            // import lazily to avoid circular init issues
            const { checkJwksStatus } = await Promise.resolve().then(() => __importStar(require('./utils/jwks')));
            const jwks = await checkJwksStatus();
            return res.json({ status: 'ok', jwks });
        }
        catch (err) {
            return res.json({ status: 'ok', jwks: { ok: false, error: String(err) } });
        }
    });
    app.use('/docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swaggerDocument));
    app.use('/api/caregivers', caregiverRoutes_1.default);
    app.use('/api/protected-members', protectedMemberRoutes_1.default);
    // 404
    app.use((req, res) => res.status(404).json({ error: { message: 'Not found' } }));
    // error handler
    app.use(errorHandler_1.errorHandler);
    return app;
}
