/**
 * Reset an admin user's password directly via the database.
 *
 * Usage:
 *   npm run reset-admin-password
 *   npm run reset-admin-password -- --username alice
 *
 * Requires shell access to the server. Not accessible via the web UI or API.
 */

import "dotenv/config";
import { createInterface } from "readline";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { fileURLToPath } from "url";
import { join, dirname } from "path";

// Inline schema — avoids .js module resolution issues in a standalone script
const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "user"] }).notNull().default("user"),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

const sqlite = new Database(process.env.DATABASE_URL ?? "./vehicles.db");
const db = drizzle(sqlite);

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), "../../../drizzle");
migrate(db, { migrationsFolder });

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    process.stdout.write(question);
    process.stdin.setRawMode(true);

    let value = "";

    const onData = (char: Buffer) => {
      const c = char.toString();
      if (c === "\r" || c === "\n" || c === "\u0004") {
        process.stdin.setRawMode(false);
        process.stdin.removeListener("data", onData);
        process.stdout.write("\n");
        rl.close();
        resolve(value);
      } else if (c === "\u0003") {
        process.stdout.write("\n");
        console.log("Cancelled.");
        process.exit(0);
      } else if (c === "\u007f") {
        value = value.slice(0, -1);
      } else {
        value += c;
      }
    };

    process.stdin.resume();
    process.stdin.on("data", onData);
  });
}

async function main() {
  const args = process.argv.slice(2);
  const usernameIdx = args.indexOf("--username");
  const targetUsername = usernameIdx !== -1 ? args[usernameIdx + 1] : null;

  console.log("\n--- Vehicle Dates: Admin Password Reset ---\n");

  // Find the target user
  let user;
  if (targetUsername) {
    const [found] = await db
      .select({ id: users.id, username: users.username, role: users.role })
      .from(users)
      .where(eq(users.username, targetUsername))
      .limit(1);
    user = found;
    if (!user) {
      console.error(`Error: No user found with username "${targetUsername}".`);
      process.exit(1);
    }
  } else {
    // Default to the first admin account
    const [found] = await db
      .select({ id: users.id, username: users.username, role: users.role })
      .from(users)
      .where(eq(users.role, "admin"))
      .limit(1);
    user = found;
    if (!user) {
      console.error("Error: No admin users found in the database.");
      process.exit(1);
    }
  }

  console.log(`Resetting password for: ${user.username} (${user.role})\n`);

  const password = await promptHidden("New password (min 8 characters): ");
  if (password.length < 8) {
    console.error("Error: Password must be at least 8 characters.");
    process.exit(1);
  }

  const confirm = await promptHidden("Confirm new password: ");
  if (password !== confirm) {
    console.error("Error: Passwords do not match.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date().toISOString();

  await db
    .update(users)
    .set({ passwordHash, updatedAt: now })
    .where(eq(users.id, user.id));

  console.log(`\nPassword for "${user.username}" has been reset successfully.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
