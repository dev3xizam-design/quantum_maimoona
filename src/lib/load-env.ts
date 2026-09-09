/**
 * Scripts run outside Next, which does not load .env.local for them.
 * Load .env.local first (that is where `neon link` writes DATABASE_URL),
 * then .env as a fallback. Neither overrides a variable already exported.
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });
