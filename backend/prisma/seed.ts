// seed = inject demo data directly into the database at startup, for dev and demo purposes

// note: everything else (form placeholders, empty state messages, input hints)
// is handled in the frontend with the HTML "placeholder" attribute - no DB needed for that
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { seedUsers } from "./seed/users";
import { seedSampleProjects } from "./seed/sample-projects";
import { seedFlagshipProject } from "./seed/flagship-project";

const prisma = new PrismaClient();

async function main() {
  const users = await seedUsers(prisma);
  await seedSampleProjects(prisma, users);
  await seedFlagshipProject(prisma);
  console.log("Seed terminé.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
