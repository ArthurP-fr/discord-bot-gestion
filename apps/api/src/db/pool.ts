import { Pool } from "pg";

import { env } from "../config/env.js";

export const createPgPool = (): Pool => {
  return new Pool({
    connectionString: env.DATABASE_URL,
    ssl: env.DATABASE_SSL
      ? {
        rejectUnauthorized: true,
      }
      : undefined,
  });
};
