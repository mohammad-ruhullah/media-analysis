// db/migrate.mjs — apply schema.sql and seed the initial admin.
// Usage: node db/migrate.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import "dotenv/config";
import pg from "pg";
import bcrypt from "bcryptjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const connectionString =
  process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Missing DATABASE_URL_UNPOOLED / DATABASE_URL in .env");
  process.exit(1);
}

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function main() {
  await client.connect();
  console.log("Connected to Neon.");

  const schema = readFileSync(join(__dirname, "schema.sql"), "utf8");
  await client.query(schema);
  console.log("Schema applied.");

  const email = (process.env.SEED_ADMIN_EMAIL || "").toLowerCase().trim();
  const password = process.env.SEED_ADMIN_PASSWORD || "";
  const name = process.env.SEED_ADMIN_NAME || "Administrator";

  if (!email || !password) {
    console.warn("SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set — skipping admin seed.");
  } else {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await client.query(
      `INSERT INTO users (email, password_hash, full_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE
         SET password_hash = EXCLUDED.password_hash,
             full_name = EXCLUDED.full_name,
             updated_at = now()
       RETURNING id`,
      [email, hash, name]
    );
    const userId = rows[0].id;
    await client.query(
      `INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin')
       ON CONFLICT (user_id, role) DO NOTHING`,
      [userId]
    );
    console.log(`Admin ready: ${email} (role: admin)`);
  }

  await client.end();
  console.log("Done.");
}

main().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});