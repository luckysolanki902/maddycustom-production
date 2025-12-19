import mongoose from 'mongoose';
import { attachDatabasePool } from '@vercel/functions';

const { MONGODB_URI } = process.env;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

/**
 * Global cache to survive hot reloads and warm lambdas
 */
global.mongooseCache = global.mongooseCache || {
  conn: null,
  promise: null,
};

const cached = global.mongooseCache;

/**
 * Tuned for:
 * - Next.js on Vercel (serverless)
 * - MongoDB Atlas M2
 * - Your observed traffic (~150 peak connections)
 */
const options = {
  bufferCommands: false,

  // Pooling — balanced choice for your usage
  maxPoolSize: 4,
  minPoolSize: 0,

  // Timeouts
  serverSelectionTimeoutMS: 8000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 25000,
  waitQueueTimeoutMS: 10000,

  // Lifecycle tuning
  maxIdleTimeMS: 15000,
  heartbeatFrequencyMS: 20000,

  retryReads: true,
  retryWrites: true,
};

/**
 * Retry helper for connection only
 */
async function withRetry(fn, retries = 3, baseDelay = 100) {
  let lastError;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      const retryable =
        err?.name === 'MongoWaitQueueTimeoutError' ||
        err?.name === 'MongoServerSelectionError' ||
        err?.message?.includes('connection pool');

      if (!retryable || attempt === retries - 1) {
        throw err;
      }

      const delay = baseDelay * 2 ** attempt;
      console.warn(
        `MongoDB connect retry ${attempt + 1}/${retries} after ${delay}ms`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError;
}

/**
 * Main connect helper
 */
export default async function connectToDatabase() {
  // Fast path: already connected
  if (cached.conn?.connection?.readyState === 1) {
    return cached.conn;
  }

  // Reset broken state
  if (cached.conn && cached.conn.connection.readyState !== 1) {
    cached.conn = null;
    cached.promise = null;
  }

  // If a connection is already in progress, wait for it
  if (cached.promise) {
    cached.conn = await cached.promise;
    return cached.conn;
  }

  // Create new connection (with retry)
  cached.promise = withRetry(async () => {
    const mongooseInstance = await mongoose.connect(MONGODB_URI, options);

    // Attach to Vercel Fluid Compute
    try {
      attachDatabasePool(mongooseInstance.connection.getClient());
    } catch (e) {
      // Safe to ignore locally
    }

    return mongooseInstance;
  }).catch((err) => {
    cached.promise = null;
    cached.conn = null;
    throw err;
  });

  cached.conn = await cached.promise;
  return cached.conn;
}

export { withRetry };
