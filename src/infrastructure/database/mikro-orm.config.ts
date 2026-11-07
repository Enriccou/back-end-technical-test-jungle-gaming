import { defineConfig } from '@mikro-orm/postgresql';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { SqlHighlighter } from '@mikro-orm/sql-highlighter';
import path from 'path';

export default defineConfig({
  driver: PostgreSqlDriver,
  dbName: process.env.DATABASE_NAME || 'jungle_gaming',
  user: process.env.DATABASE_USER || 'jungle',
  password: process.env.DATABASE_PASSWORD || 'jungle_dev_password',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),

  entities: [
    'dist/infrastructure/database/entities',
  ],
  entitiesTs: [
    'src/infrastructure/database/entities',
  ],

  migrations: {
    path: 'dist/infrastructure/database/migrations',
    pathTs: 'src/infrastructure/database/migrations',
    glob: '!(*.d).ts',
    transactional: true,
    allOrNothing: true,
    safe: false,
    snapshot: false,
  },

  highlighter: new SqlHighlighter(),
  debug: process.env.NODE_ENV !== 'production',
  strict: true,
  validate: true,
  forceUtcTimezone: true,
  timezone: 'UTC',
});
