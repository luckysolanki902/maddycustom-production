// @/lib/mongodb.js
import mongoose from 'mongoose';

const { MONGODB_URI } = process.env;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable in .env');
}

// Fixed configuration constants
const MAX_POOL_SIZE = 1000;    // Adjust this to handle large numbers of concurrent connections
const MIN_POOL_SIZE = 0;       // Allow scaling down to zero connections during low load
const CONNECTION_RETRIES = 3;  // Number of retries for transient connection failures
const RETRY_DELAY_MS = 2000;   // Delay between retries in milliseconds

// Reuse the cached global variable to avoid multiple connections in the same runtime
let cached = global._mongoose;
if (!cached) {
  cached = global._mongoose = { conn: null, promise: null };
}

// Recommended Mongoose settings for production performance
mongoose.set('strictQuery', false);  // Enhance performance by avoiding legacy query features
mongoose.set('autoIndex', false);    // Disable auto-creation of indexes in production

// Log initial config
console.info(`MongoDB: maxPoolSize=${MAX_POOL_SIZE}, minPoolSize=${MIN_POOL_SIZE}, retries=${CONNECTION_RETRIES}, retryDelayMs=${RETRY_DELAY_MS}`);

/**
 * Attempt to connect to MongoDB with retry logic.
 */
async function attemptConnection(attempt = 1) {
  const opts = {
    bufferCommands: false,
    maxPoolSize: MAX_POOL_SIZE,
    minPoolSize: MIN_POOL_SIZE,
    serverSelectionTimeoutMS: 5000, // Fail fast if no servers can be selected within 5s
    socketTimeoutMS: 45000,         // Socket timeout for long-running queries
    // Removed keepAlive since it's no longer supported as a top-level option
  };

  try {
    const mongooseInstance = await mongoose.connect(MONGODB_URI, opts);
    return mongooseInstance;
  } catch (err) {
    console.error(`MongoDB: Connection attempt ${attempt} failed:`, err);
    // If the error might be related to connection limits or pool exhaustion:
    if (err.message && (err.message.includes('connection limit') || err.message.includes('exceeded'))) {
      console.warn('MongoDB: Connection limit reached or exceeded. Consider increasing maxPoolSize or adding more DB nodes.');
    }

    if (attempt < CONNECTION_RETRIES) {
      console.info(`MongoDB: Retrying connection in ${RETRY_DELAY_MS}ms... (Attempt ${attempt + 1} of ${CONNECTION_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      return attemptConnection(attempt + 1);
    }

    throw err; // Rethrow if no more retries left
  }
}

/**
 * Connect to MongoDB with a single cached connection per runtime instance.
 * Tuned for high concurrency environments, but also handles low-usage periods gracefully.
 */
async function connectToDatabase() {
  // If a connection is already established and ready, return it
  if (cached.conn && cached.conn.readyState === 1) {
    return cached.conn;
  }

  // If there is no existing promise, create a new one
  if (!cached.promise) {
    console.info('MongoDB: Initiating new connection...');
    cached.promise = attemptConnection()
      .then((mongooseInstance) => {
        return mongooseInstance;
      })
      .catch((err) => {
        console.error('MongoDB: Error during initial connection after retries:', err);
        cached.promise = null;
        throw err;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    console.error('MongoDB: Connection promise rejected:', err);
    if (err.message && (err.message.includes('connection limit') || err.message.includes('exceeded'))) {
      console.warn('MongoDB: Connection limit reached or exceeded. Consider scaling the database.');
    }
    cached.promise = null;
    throw err;
  }

  return cached.conn;
}

// Event listeners for connection events to monitor state changes
mongoose.connection.on('connected', () => {
  console.info('MongoDB: Connection established.');
});

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB: Connection lost. Waiting for next request to re-establish.');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB: Connection error encountered:', err);
});

export default connectToDatabase;
