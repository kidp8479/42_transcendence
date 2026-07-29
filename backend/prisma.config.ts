import { defineConfig } from "prisma/config";

import dotenv from "dotenv";
import path from "path";
// path resolved from __dirname (not cwd) - Prisma CLI commands can be run
// from backend/ or from the repo root, and the only .env file lives at the
// repo root, one level up from this file.
dotenv.config({ path: path.resolve(__dirname, "../.env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts", // or ts-node, matching your current seed command
  },
  datasource: {
    // Prisma generates its client during dependency installation, before the
    // runtime AppRole can obtain a dynamic database lease. Migration tooling
    // supplies DATABASE_URL only for its short-lived Vault credential.
    url:
      process.env.DATABASE_URL ??
      "postgresql://prisma-generate:prisma-generate@localhost:5432/prisma-generate",
  },
});
