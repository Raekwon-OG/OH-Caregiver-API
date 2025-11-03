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

  const swaggerDocument = openapiDocument as any;

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
  app.use(cors());
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
