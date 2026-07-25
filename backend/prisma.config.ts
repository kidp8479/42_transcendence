import "dotenv/config";
import { defineConfig } from "prisma/config";

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