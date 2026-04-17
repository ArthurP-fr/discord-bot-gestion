import { Pool } from "pg";

import { env } from "../config/env.js";

export const createPgPool = (): Pool => {
  const ssl = env.DATABASE_SSL
    ? {
      rejectUnauthorized: env.DATABASE_SSL_REJECT_UNAUTHORIZED,
      ca: env.DATABASE_SSL_CA,
    }
    : undefined;

  return new Pool({
    connectionString: env.DATABASE_URL,
    ssl,
  });
};
