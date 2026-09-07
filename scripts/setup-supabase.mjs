/**
 * Automated Supabase Setup & Migration Script for SmartPME
 * Project: LMS-dismartpme (ctcejtsifmjdskygndok)
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const PROJECT_ID = "ctcejtsifmjdskygndok";
const PROJECT_URL = "https://ctcejtsifmjdskygndok.supabase.co";

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.log("Usage: node scripts/setup-supabase.mjs <DATABASE_PASSWORD_OR_URI>");
    process.exit(1);
  }

  let databaseUrl = "";
  let directUrl = "";

  if (arg.startsWith("postgresql://") || arg.startsWith("postgres://")) {
    databaseUrl = arg;
    directUrl = arg.replace(":6543", ":5432").replace("?pgbouncer=true", "");
  } else {
    // Treat as password
    const encodedPassword = encodeURIComponent(arg.trim());
    // Pooler URL (Session/Transaction mode)
    databaseUrl = `postgresql://postgres.${PROJECT_ID}:${encodedPassword}@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true`;
    // Direct URL for migrations (Session mode on pooler)
    directUrl = `postgresql://postgres.${PROJECT_ID}:${encodedPassword}@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`;
  }

  console.log(`[Supabase] Configuring project: LMS-dismartpme (${PROJECT_ID})...`);

  // 1. Update prisma/schema.prisma
  const schemaPath = path.resolve("prisma/schema.prisma");
  let schema = fs.readFileSync(schemaPath, "utf8");

  schema = schema.replace(/provider\s*=\s*"sqlite"/, 'provider = "postgresql"');
  if (!schema.includes("directUrl")) {
    schema = schema.replace(
      'url      = env("DATABASE_URL")',
      'url       = env("DATABASE_URL")\n  directUrl = env("DIRECT_URL")'
    );
  }
  fs.writeFileSync(schemaPath, schema, "utf8");
  console.log("[Supabase] prisma/schema.prisma updated to postgresql.");

  // 2. Update .env
  const envPath = path.resolve(".env");
  let envContent = fs.readFileSync(envPath, "utf8");

  if (envContent.includes("DATABASE_URL=")) {
    envContent = envContent.replace(/DATABASE_URL=.*(\r?\n|$)/, `DATABASE_URL="${databaseUrl}"\n`);
  } else {
    envContent += `\nDATABASE_URL="${databaseUrl}"\n`;
  }

  if (envContent.includes("DIRECT_URL=")) {
    envContent = envContent.replace(/DIRECT_URL=.*(\r?\n|$)/, `DIRECT_URL="${directUrl}"\n`);
  } else {
    envContent += `DIRECT_URL="${directUrl}"\n`;
  }

  fs.writeFileSync(envPath, envContent, "utf8");
  console.log("[Supabase] .env updated with Supabase connection strings.");

  // 3. Run prisma generate & prisma db push
  console.log("[Supabase] Generating Prisma Client for PostgreSQL...");
  execSync("npx prisma generate", { stdio: "inherit" });

  console.log("[Supabase] Pushing database schema to Supabase PostgreSQL...");
  execSync("npx prisma db push --accept-data-loss", { stdio: "inherit" });

  // 4. Migrate existing data from SQLite dump
  if (fs.existsSync("scripts/sqlite_dump.json")) {
    console.log("[Supabase] Migrating existing SQLite data to Supabase...");
    try {
      execSync("node scripts/restore-to-supabase.js", { stdio: "inherit" });
    } catch (e) {
      console.warn("[Supabase] Data migration warning (schema was created):", e.message);
    }
  }

  console.log("\n============================================================");
  console.log(" SUCCESS! Database Supabase project LMS-dismartpme is ready!");
  console.log(" All tables and relations have been created automatically.");
  console.log("============================================================\n");
}

main().catch((err) => {
  console.error("[Supabase Setup Error]", err);
  process.exit(1);
});
