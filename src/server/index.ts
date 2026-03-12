import "dotenv/config";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { vehiclesRouter } from "./routes/vehicles.js";
import { settingsRouter } from "./routes/settings.js";
import { authRouter } from "./routes/auth.js";
import { usersRouter } from "./routes/users.js";
import { startScheduledRefresh } from "./jobs/dvlaRefresh.js";
import { requireAuth } from "./middleware/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Auto-migrate on startup
function runMigrations() {
  const DB_PATH = process.env.DATABASE_URL ?? "./vehicles.db";
  const migrationsFolder = path.resolve(__dirname, "../../drizzle");
  try {
    const sqlite = new Database(DB_PATH);
    const db = drizzle(sqlite);
    migrate(db, { migrationsFolder });
    sqlite.close();
    console.log("Database migrations applied.");
  } catch (err) {
    console.error("Migration error (may be first run without migrations):", err);
  }
}

const app = new Hono();

app.use("*", logger());
app.use(
  "/api/*",
  cors({
    origin: ["http://localhost:5173"],
    allowMethods: ["GET", "POST", "PUT", "DELETE"],
  })
);

app.route("/api/auth", authRouter);

app.use("/api/vehicles/*", requireAuth);
app.use("/api/settings/*", requireAuth);
app.use("/api/users/*", requireAuth);

app.route("/api/vehicles", vehiclesRouter);
app.route("/api/settings", settingsRouter);
app.route("/api/users", usersRouter);

// Health check
app.get("/api/health", (c) => c.json({ status: "ok" }));

// Serve static files in production
const isProd = process.env.NODE_ENV === "production";
if (isProd) {
  app.use(
    "/*",
    serveStatic({
      root: path.resolve(__dirname, "../../dist"),
    })
  );
  app.get("*", async (c) => {
    const html = await import("fs").then((fs) =>
      fs.promises.readFile(
        path.resolve(__dirname, "../../dist/index.html"),
        "utf-8"
      )
    );
    return c.html(html);
  });
}

const PORT = parseInt(process.env.PORT ?? "3001");

runMigrations();
startScheduledRefresh();

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export type AppType = typeof app;
