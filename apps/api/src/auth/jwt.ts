import { SignJWT, jwtVerify } from "jose";

import { env } from "../config/env.js";
import type { AuthSession } from "../types/auth.js";

interface SessionJwtPayload {
  sub: string;
  tenantId: string;
  discordUserId: string;
  username: string;
}

const secret = new TextEncoder().encode(env.JWT_SECRET);

export const issueSessionToken = async (session: AuthSession): Promise<string> => {
  return new SignJWT({
    tenantId: session.tenantId,
    discordUserId: session.discordUserId,
    username: session.username,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.userId)
    .setIssuedAt()
    .setExpirationTime(env.JWT_EXPIRES_IN)
    .sign(secret);
};

export const verifySessionToken = async (token: string): Promise<AuthSession> => {
  const verified = await jwtVerify<SessionJwtPayload>(token, secret, {
    algorithms: ["HS256"],
  });

  if (!verified.payload.sub) {
    throw new Error("session token missing subject");
  }

  return {
    userId: verified.payload.sub,
    tenantId: verified.payload.tenantId,
    discordUserId: verified.payload.discordUserId,
    username: verified.payload.username,
  };
};
