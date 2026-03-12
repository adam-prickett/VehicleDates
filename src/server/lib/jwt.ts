import { SignJWT, jwtVerify } from "jose";

export interface JwtPayload {
  sub: string;
  username: string;
  role: string;
}

function getSecret() {
  const secret = process.env.JWT_SECRET ?? "dev-secret-change-me-in-production";
  if (process.env.NODE_ENV === "production" && secret === "dev-secret-change-me-in-production") {
    console.warn("[Auth] WARNING: JWT_SECRET is not set. Using insecure default.");
  }
  return new TextEncoder().encode(secret);
}

export async function signToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({ username: payload.username, role: payload.role })
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
    };
  } catch {
    return null;
  }
}
