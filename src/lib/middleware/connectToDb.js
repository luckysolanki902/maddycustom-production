//@/lib/middleware/connectToDb
import mongoose from 'mongoose';

const { MONGODB_URI } = process.env;

if (!MONGODB_URI) {
  console.error('MONGODB_URI environment variable not defined.');
  throw new Error('Please define the MONGODB_URI environment variable.');
}

// Global cache to prevent multiple connections in dev mode
let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

// Use a very small pool size to avoid too many connections per Lambda
const options = {
  bufferCommands: false,
  maxPoolSize: 1,
  minPoolSize: 0,
  serverSelectionTimeoutMS: 5000,   // Fail fast if no server is found
  socketTimeoutMS: 30000,          // Socket idle timeout
  heartbeatFrequencyMS: 10000,     // Ping server every 10s
  maxIdleTimeMS: 10000,            // Reap idle connections after 10s
  waitQueueTimeoutMS: 5000,        // Time to wait in queue for a connection
};

async function connectToDatabase() {
  // Return existing connection if stable
  if (cached.conn && cached.conn.readyState === 1) {
    return cached.conn;
  }

  // If a connection is already in progress, await it
  if (cached.promise) {
    cached.conn = await cached.promise;
    return cached.conn;
  }

  // Create a new connection if none exist

  cached.promise = mongoose.connect(MONGODB_URI, options).then((mongooseInstance) => {
    return mongooseInstance;
  }).catch(err => {
    console.error(`MongoDB: Connection error - ${err.message}`);
    cached.promise = null;
    throw err;
  });

  cached.conn = await cached.promise;
  return cached.conn;
}

export default connectToDatabase;
