import type { Router } from "express";
import { Router as expressRouter } from "express";
import type { Pool } from "pg";

import { buildDiscordLoginUrl, createOauthState, exchangeCodeForDiscordIdentity } from "../auth/discordOAuth.js";
import { issueSessionToken } from "../auth/jwt.js";
import { env } from "../config/env.js";
import { upsertUserFromDiscord } from "../db/repositories.js";

const OAUTH_STATE_COOKIE_NAME = "discord_oauth_state";
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface AuthRouterDependencies {
  pool: Pool;
}

const sessionCookieConfig = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.COOKIE_SECURE,
  maxAge: SESSION_TTL_MS,
  path: "/",
};

export const createAuthRouter = ({ pool }: AuthRouterDependencies): Router => {
  const router = expressRouter();

  router.get("/discord/login", (_req, res) => {
    const state = createOauthState();

    res.cookie(OAUTH_STATE_COOKIE_NAME, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.COOKIE_SECURE,
      maxAge: OAUTH_STATE_TTL_MS,
      path: "/auth/discord/callback",
    });

    res.redirect(buildDiscordLoginUrl(state));
  });

  router.get("/discord/callback", async (req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const cookieState = req.cookies?.[OAUTH_STATE_COOKIE_NAME];

    if (!code || !state || !cookieState || state !== cookieState) {
      res.clearCookie(OAUTH_STATE_COOKIE_NAME, { path: "/auth/discord/callback" });
      res.redirect(`${env.WEB_URL}/login?error=oauth_state_invalid`);
      return;
    }

    try {
      const discordIdentity = await exchangeCodeForDiscordIdentity(code);
      const user = await upsertUserFromDiscord(pool, {
        discordUserId: discordIdentity.id,
        username: discordIdentity.username,
        avatarUrl: discordIdentity.avatarUrl,
      });

      const sessionToken = await issueSessionToken({
        userId: user.id,
        tenantId: user.tenantId,
        discordUserId: user.discordUserId,
        username: user.username,
      });

      res.clearCookie(OAUTH_STATE_COOKIE_NAME, { path: "/auth/discord/callback" });
      res.cookie(env.SESSION_COOKIE_NAME, sessionToken, sessionCookieConfig);
      res.redirect(`${env.WEB_URL}/dashboard`);
    } catch {
      res.clearCookie(OAUTH_STATE_COOKIE_NAME, { path: "/auth/discord/callback" });
      res.redirect(`${env.WEB_URL}/login?error=oauth_failed`);
    }
  });

  router.post("/logout", (_req, res) => {
    res.clearCookie(env.SESSION_COOKIE_NAME, { path: "/" });
    res.status(204).send();
  });

  return router;
};
