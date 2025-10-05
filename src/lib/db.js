// Barrel wrapper for database connection.
// Always import from '@/lib/db' instead of '@/lib/middleware/connectToDb'.
import connectToDatabase from './middleware/connectToDb';

export default async function db() {
  return connectToDatabase();
}
