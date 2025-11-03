import mongoose from 'mongoose';
import { logger } from '../utils/logger';

export async function connectDatabase(uri: string) {
  try {
    await mongoose.connect(uri, {
      // useNewUrlParser, useUnifiedTopology are defaults in Mongoose 6+
    } as mongoose.ConnectOptions);
    logger.info('Connected to MongoDB');
  } catch (err) {
    logger.error('MongoDB connection error', { err });
    throw err;
  }
}
