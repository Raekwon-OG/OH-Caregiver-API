import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import { createApp } from './app';
import { connectDatabase } from './config/database';
import { logger } from './utils/logger';
import { initSocket } from './utils/socket';

const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/oh-caregiver';

async function start() {
  await connectDatabase(MONGODB_URI);
  const app = createApp();
  const server = http.createServer(app);
  initSocket(server);

  server.listen(PORT, () => {
    logger.info(`Server listening on port ${PORT}`);
  });
}

start().catch((err) => {
  logger.error('Failed to start', { err });
  process.exit(1);
});
