import 'dotenv/config';
import { MikroORM } from '@mikro-orm/core';
import { PostgreSqlDriver } from "@mikro-orm/postgresql";
import { SqlHighlighter } from "@mikro-orm/sql-highlighter";

async function run() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not defined");
  }

  const url = new URL(databaseUrl);

  const orm = await MikroORM.init({
    driver: PostgreSqlDriver,
    dbName: url.pathname.slice(1),
    user: url.username,
    password: url.password,
    host: url.hostname,
    port: url.port ? parseInt(url.port, 10) : 5432,
    entities: ["dist/infrastructure/database/entities"],
    entitiesTs: ["src/infrastructure/database/entities"],
    migrations: {
      path: "dist/infrastructure/database/migrations",
      pathTs: "src/infrastructure/database/migrations",
    },
    highlighter: new SqlHighlighter(),
    debug: true,
  });
  const migrator = orm.getMigrator();
  await migrator.up();
  await orm.close();
  console.log("✅ Migrations completed");
}

run().catch(console.error);
