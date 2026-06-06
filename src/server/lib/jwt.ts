import { SignJWT, jwtVerify } from "jose";

const DEFAULT_DEV_SECRET = "dev-secret-change-me-in-production";

export interface JwtPayload {
  sub: string;
  username: string;
  role: string;
  ver?: number;
}

function getSecret() {
  const secret = process.env.JWT_SECRET;
  const isProd = process.env.NODE_ENV === "production";
  if (!secret || secret === DEFAULT_DEV_SECRET) {
    if (isProd) {
      throw new Error(
        "JWT_SECRET must be set to a strong random value when NODE_ENV=production. " +
          "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
      );
    }
    return new TextEncoder().encode(DEFAULT_DEV_SECRET);
  }
  return new TextEncoder().encode(secret);
}

export async function signToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({
    username: payload.username,
    role: payload.role,
    ver: payload.ver ?? 0,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setExpirationTime("7d")
    .setIssuedAt()
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      sub: payload.sub as string,
      username: payload.username as string,
      role: payload.role as string,
      ver: typeof payload.ver === "number" ? payload.ver : 0,
    };
  } catch {
    return null;
  }
}
