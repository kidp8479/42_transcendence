import { PrismaClient } from "@prisma/client";
import { seedUsers } from "./seed/users";
import { seedSampleProjects } from "./seed/sample-projects";
import { seedFlagshipProject } from "./seed/flagship-project";

export async function seedDatabase(
  prisma: PrismaClient,
  seedPassword: string
): Promise<void> {
  const users = await seedUsers(prisma, seedPassword);
  await seedSampleProjects(prisma, users);
  await seedFlagshipProject(prisma, seedPassword);
  console.log("Seed terminé.");
}
