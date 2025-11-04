import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { globalLimiter } from './middleware/rateLimiters';
import swaggerUi from 'swagger-ui-express';
import openapiDocument from './docs/openapi.json';
import { json } from 'body-parser';
import { logger } from './utils/logger';
import { initJwks, prewarmJwks } from './utils/jwks';
import { errorHandler } from './middleware/errorHandler';
import caregiverRoutes from './routes/caregiverRoutes';
import protectedMemberRoutes from './routes/protectedMemberRoutes';

  // Clone and patch the OpenAPI document so Swagger UI points at the correct server
  // Use SWAGGER_SERVER_URL or API_URL env var when provided, otherwise fall back to localhost with PORT
  const swaggerDocument = JSON.parse(JSON.stringify(openapiDocument)) as any;
  const envServer = process.env.SWAGGER_SERVER_URL || process.env.API_URL || `http://localhost:${process.env.PORT || 4000}`;
  // Ensure servers array is present and points to the runtime URL
  swaggerDocument.servers = [{ url: envServer, description: 'Runtime API server' }];

export async function createApp() {
  // Initialize JWKS early to pre-warm keys for RS256 verification
  try {
    initJwks(process.env.SUPABASE_URL);
    if (process.env.SUPABASE_URL) {
      const pre = await prewarmJwks();
      // Log only a non-sensitive summary so we don't leak JWKS endpoints or full error bodies.
      logger.info('JWKS prewarm result', {
        ok: Boolean(pre?.ok),
        status: (pre as any)?.status ?? null,
        lastErrorAt: (pre as any)?.lastError?.at ?? null,
      });
    }
  } catch (err) {
    logger.warn('JWKS initialization/prewarm failed', { err });
  }

  const app = express();
  app.use(helmet());

  // Configure CORS dynamically via env vars so deployed API can accept requests
  // from the frontend origin(s). Set CORS_ORIGIN to a comma-separated list of
  // allowed origins (e.g. https://app.example.com,https://staging.example.com).
  // If CORS_ALLOW_CREDENTIALS=true, the origin MUST be explicit (cannot be '*').
  const rawOrigins = process.env.CORS_ORIGIN;
  const allowedOrigins = rawOrigins
    ? rawOrigins.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  const corsOptions: any = {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // browser-based requests have an origin; server-side tools (curl, server-to-server)
      // may not include one. Allow when origin is missing.
      if (!origin) return callback(null, true);
      if (allowedOrigins.length === 0) {
        // if no explicit origins configured, allow all
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['Content-Range', 'X-Total-Count'],
    optionsSuccessStatus: 204,
    credentials: (process.env.CORS_ALLOW_CREDENTIALS === 'true') || false,
  };

  // Attach CORS and preflight handling
  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));

  app.use(json());

  // Global rate limiter
  app.use(globalLimiter);

  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  // enhance health with JWKS status
  app.get('/health', async (req, res) => {
    try {
      // import lazily to avoid circular init issues
      const { checkJwksStatus } = await import('./utils/jwks');
      const jwks = await checkJwksStatus();
      return res.json({ status: 'ok', jwks });
    } catch (err) {
      return res.json({ status: 'ok', jwks: { ok: false, error: String(err) } });
    }
  });

  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

  app.use('/api/caregivers', caregiverRoutes);
  app.use('/api/protected-members', protectedMemberRoutes);

  // 404
  app.use((req, res) => res.status(404).json({ error: { message: 'Not found' } }));

  // error handler
  app.use(errorHandler);

  return app;
}
