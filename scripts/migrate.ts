import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

const dbPath = process.env.DRIZZLE_DB_PATH ?? './.data/scenesift-dev.db';
const projectRoot = process.cwd();
const migrationsFolder = join(projectRoot, 'src', 'database', 'migrations');
mkdirSync(dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);
const db = drizzle(sqlite);

migrate(db, {
  migrationsFolder,
});

sqlite.close();
console.log(`[SceneSift] Migrations applied to ${dbPath} from ${projectRoot}`);
