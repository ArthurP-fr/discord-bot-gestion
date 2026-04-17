import { randomBytes } from "node:crypto";

import { z } from "zod";

import { env } from "../config/env.js";

const DISCORD_API_BASE = "https://discord.com/api/v10";

const oauthTokenSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
});

const discordUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  avatar: z.string().nullable(),
  global_name: z.string().nullable().optional(),
});

const discordBotSchema = z.object({
  id: z.string(),
  username: z.string(),
  discriminator: z.string(),
  global_name: z.string().nullable().optional(),
});

export interface DiscordIdentity {
  id: string;
  username: string;
  avatarUrl: string | null;
}

export interface DiscordBotIdentity {
  id: string;
  displayName: string;
}

export const createOauthState = (): string => {
  return randomBytes(24).toString("base64url");
};

export const buildDiscordLoginUrl = (state: string): string => {
  const params = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    redirect_uri: env.DISCORD_REDIRECT_URI,
    response_type: "code",
    scope: "identify",
    state,
    prompt: "consent",
  });

  return `https://discord.com/oauth2/authorize?${params.toString()}`;
};

const createAvatarUrl = (discordUserId: string, avatarHash: string | null): string | null => {
  if (!avatarHash) {
    return null;
  }

  return `https://cdn.discordapp.com/avatars/${discordUserId}/${avatarHash}.png`;
};

export const exchangeCodeForDiscordIdentity = async (code: string): Promise<DiscordIdentity> => {
  const payload = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    client_secret: env.DISCORD_CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: env.DISCORD_REDIRECT_URI,
  });

  const tokenResponse = await fetch(`${DISCORD_API_BASE}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: payload,
  });

  if (!tokenResponse.ok) {
    throw new Error("Discord OAuth token exchange failed");
  }

  const tokenJson = oauthTokenSchema.parse(await tokenResponse.json());

  const userResponse = await fetch(`${DISCORD_API_BASE}/users/@me`, {
    headers: {
      Authorization: `${tokenJson.token_type} ${tokenJson.access_token}`,
    },
  });

  if (!userResponse.ok) {
    throw new Error("Discord user profile fetch failed");
  }

  const userJson = discordUserSchema.parse(await userResponse.json());

  return {
    id: userJson.id,
    username: userJson.global_name ?? userJson.username,
    avatarUrl: createAvatarUrl(userJson.id, userJson.avatar),
  };
};

export const validateDiscordBotToken = async (botToken: string): Promise<DiscordBotIdentity> => {
  const response = await fetch(`${DISCORD_API_BASE}/users/@me`, {
    headers: {
      Authorization: `Bot ${botToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Invalid Discord bot token");
  }

  const botJson = discordBotSchema.parse(await response.json());
  return {
    id: botJson.id,
    displayName: botJson.global_name ?? botJson.username,
  };
};
