import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

export const createDatabaseClient = (dbPath: string) => {
  const sqlite = new Database(dbPath);
  return {
    sqlite,
    db: drizzle(sqlite),
  };
};
