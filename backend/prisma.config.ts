import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts", // or ts-node, matching your current seed command
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});