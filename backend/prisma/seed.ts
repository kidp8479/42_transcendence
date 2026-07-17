// seed = inject demo data directly into the database at startup, for dev and demo purposes
// run with: npx prisma db seed (configured in package.json under "prisma.seed", requires ts-node - already installed)
// adapted from Christophe's seed on feat(TR-38)/sidebar - task categories corrected below
// to match the team-decided default list (see summary.tsx mock + Notion), his version
// still had an earlier draft list.

// note: everything else (form placeholders, empty state messages, input hints)
// is handled in the frontend with the HTML "placeholder" attribute - no DB needed for that
import "dotenv/config";
import { PrismaClient, ProjectStatus, DiscoveryBlockStatus } from "@prisma/client";

const prisma = new PrismaClient();

// every seeded user shares this password, so anyone on the team can log in
// locally as "andrei@42.fr" / SEED_PASSWORD, etc. - only for local dev, never
// for anything resembling a real deployment
const SEED_PASSWORD = "SeedPassword123!";

// register a user through the real Go auth service (not prisma.user.create)
// so the account is actually loggable - auth.register() creates the User row
// itself, plus the AuthIdentity/PasswordCredential rows the seed has no
// business writing to directly (argon2id hashing lives in the auth service).
// AUTH_SERVICE_URL comes from docker-compose env (internal network address,
// ex: http://auth:3001) - Origin must match APP_ORIGIN or the auth service
// rejects the request (same check a real browser request goes through).
async function registerSeedUser(email: string, username: string) {
  const res = await fetch(`${process.env.AUTH_SERVICE_URL}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:8080",
    },
    body: JSON.stringify({ email, username, password: SEED_PASSWORD }),
  });

  if (res.status === 201) {
    const body = await res.json();
    return body.user.id as string;
  }

  // re-running the seed: this email is already registered - look up the
  // existing user instead of failing (register() never upserts, it always
  // tries to create)
  if (res.status === 409 || res.status === 400) {
    const existing = await prisma.user.findUniqueOrThrow({ where: { email } });
    return existing.id;
  }

  throw new Error(
    `auth register failed for ${email}: ${res.status} ${await res.text()}`,
  );
}

async function main() {
  // 1. Users (sorry girls, it's alphabetical order)

  const usersData = [
    { username: "andrei", campus: "42 London" },
    { username: "carlos", campus: "42 Paris" },
    { username: "christophe", campus: "42 Paris" },
    { username: "diana", campus: "42 Paris" },
    { username: "pauline", campus: "42 Paris" },
  ];

  const createdUsers: Record<
    string,
    Awaited<ReturnType<typeof prisma.user.upsert>>
  > = {};

  for (const u of usersData) {
    const email = `${u.username}@42.fr`;
    const userId = await registerSeedUser(email, u.username);
    // register() has no "campus" field (that's a profile detail, not part of
    // local auth) - set it separately with a plain prisma update
    createdUsers[u.username] = await prisma.user.update({
      where: { id: userId },
      data: { campus: u.campus },
    });
  }

  const { andrei, carlos, christophe, diana, pauline } = createdUsers;
  const users = [andrei, carlos, christophe, diana, pauline];

  // 2. Projects
  const projectsData = [
    {
      name: "ft_transcendence",
      description:
        "Full-stack web app with real-time multiplayer Pong game and OAuth",
      status: ProjectStatus.IN_PROGRESS,
      members: users,
    },
    {
      name: "minishell",
      description: "A minimal bash-like shell",
      status: ProjectStatus.IN_PROGRESS,
      members: [andrei, carlos, christophe],
    },
    {
      name: "minishell",
      description:
        "A minimal bash-like shell with built-ins, pipes, and redirections",
      status: ProjectStatus.IN_PROGRESS,
      members: [diana, pauline],
    },
    ...users.flatMap((user) => [
      {
        name: "philosophers",
        description: "Dining philosophers problem with threads and mutexes",
        status: ProjectStatus.IN_PROGRESS,
        members: [user],
      },
      {
        name: "push_swap",
        description: "Sorting algorithms",
        status: ProjectStatus.COMPLETED,
        members: [user],
      },
      {
        name: "libft",
        description: "Sorting algorithms",
        status: ProjectStatus.COMPLETED,
        members: [user],
      },
    ]),
  ];

  const createdProjects = [];
  for (const p of projectsData) {
    const project = await prisma.project.create({
      data: {
        name: p.name,
        description: p.description,
        status: p.status,
        members: {
          create: p.members.map((u) => ({ userId: u.id })),
        },
      },
    });
    createdProjects.push(project);
  }

  // 3. Default Discovery Blocks (on every project)
  const discoveryCategories = [
    { title: "PDF Project Understanding", icon: "search", color: 0 },
    { title: "Constraints", icon: "layers", color: 1 },
    { title: "Questions", icon: "palette", color: 2 },
    { title: "Roadmap", icon: "link", color: 3 },
    { title: "Resources", icon: "notebook", color: 4 },
    { title: "Concepts", icon: "wheel", color: 5 },
  ];

  for (const project of createdProjects) {
    for (const cat of discoveryCategories) {
      await prisma.discoveryBlock.create({
        data: {
          projectId: project.id,
          title: cat.title,
          icon: cat.icon,
          color: cat.color,
          status: DiscoveryBlockStatus.NOT_STARTED,
          discoveryBlockItems: {
            create: [
              { label: "", order: 0 },
              { label: "", order: 1 },
            ],
          },
        },
      });
    }
  }

  // 4. Task categories - REAL data, not dev-only like the users/projects
  // above. This is the actual default category list every new project
  // should get in production too (team-decided, matches the Summary tab
  // mock data and the Notion doc "13. Summary" page), NOT the earlier draft
  // list. Bounded to 8 entries (0-7) - CATEGORY_COLOR_PALETTE on the
  // frontend has no color past index 7 yet.
  // IMPORTANT: this seed only applies these categories to the fake demo
  // projects created above - it does NOT run for real projects created
  // through the app. Whoever implements ProjectsService.create() (still
  // TODO) must insert this same list of 8 categories for every new project,
  // not just rely on this seed - this array is the source of truth to copy
  // from, not a substitute for that logic.
  const taskCategories = [
    { name: "Planning", color: 0 },
    { name: "Development", color: 1 },
    { name: "Testing", color: 2 },
    { name: "Backend", color: 3 },
    { name: "Frontend", color: 4 },
    { name: "DevOps", color: 5 },
    { name: "Parsing", color: 6 },
    { name: "Documentation", color: 7 },
  ];

  for (const project of createdProjects) {
    for (const cat of taskCategories) {
      await prisma.taskCategory.create({
        data: {
          projectId: project.id,
          name: cat.name,
          color: cat.color,
        },
      });
    }
  }

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
