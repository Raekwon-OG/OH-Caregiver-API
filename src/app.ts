import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import { json } from 'body-parser';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import caregiverRoutes from './routes/caregiverRoutes';
import protectedMemberRoutes from './routes/protectedMemberRoutes';

const swaggerDocument = {} as any; // placeholder - generate later

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(json());

  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      max: 100,
    })
  );

  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

  app.use('/api/caregivers', caregiverRoutes);
  app.use('/api/protected-members', protectedMemberRoutes);

  // 404
  app.use((req, res) => res.status(404).json({ error: { message: 'Not found' } }));

  // error handler
  app.use(errorHandler);

  return app;
}
