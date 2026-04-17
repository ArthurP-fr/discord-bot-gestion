import type { RequestHandler } from "express";

import { env } from "../config/env.js";
import { verifySessionToken } from "../auth/jwt.js";

export const requireAuth: RequestHandler = async (req, res, next) => {
  const sessionToken = req.cookies?.[env.SESSION_COOKIE_NAME];

  if (!sessionToken) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    req.auth = await verifySessionToken(sessionToken);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired session" });
  }
};
