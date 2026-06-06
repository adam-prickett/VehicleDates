import type { Context, Next } from "hono";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function hostOf(value: string): string | null {
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

function allowedHosts(c: Context): Set<string> {
  const envList = process.env.ALLOWED_ORIGINS;
  if (envList) {
    return new Set(
      envList
        .split(",")
        .map((o) => hostOf(o.trim()))
        .filter((h): h is string => !!h)
    );
  }

  const hosts = new Set<string>();
  const requestHost = (
    c.req.header("x-forwarded-host") ??
    c.req.header("host") ??
    hostOf(c.req.url) ??
    ""
  ).toLowerCase();
  if (requestHost) hosts.add(requestHost);
  if (process.env.NODE_ENV !== "production") {
    hosts.add("localhost:5173");
  }
  return hosts;
}

export async function requireSameOrigin(c: Context, next: Next) {
  if (SAFE_METHODS.has(c.req.method)) {
    await next();
    return;
  }

  const headerValue =
    c.req.header("origin") ?? c.req.header("referer") ?? "";
  if (!headerValue) {
    return c.json(
      { error: "Origin header required for state-changing requests" },
      403
    );
  }

  const requestOriginHost = hostOf(headerValue);
  if (!requestOriginHost) {
    return c.json({ error: "Invalid Origin header" }, 403);
  }

  const allowed = allowedHosts(c);
  if (!allowed.has(requestOriginHost)) {
    return c.json({ error: "Origin not allowed" }, 403);
  }

  await next();
}
