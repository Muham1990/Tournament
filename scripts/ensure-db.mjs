import pg from "pg";

const c = new pg.Client({
  host: "127.0.0.1",
  port: 5432,
  user: "postgres",
  password: "postgres",
  database: "postgres",
  ssl: false,
});
await c.connect();
const r = await c.query("SELECT 1 FROM pg_database WHERE datname = 'kumite_arena'");
if (!r.rows.length) {
  await c.query("CREATE DATABASE kumite_arena");
  console.log("created");
} else {
  console.log("exists");
}
await c.end();
