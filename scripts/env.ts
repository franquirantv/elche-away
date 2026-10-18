import { loadEnvConfig } from "@next/env";

// Match Next.js local environment loading; existing process variables win in CI.
loadEnvConfig(process.cwd(), true);
