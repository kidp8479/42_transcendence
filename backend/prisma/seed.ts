// seed = inject demo data directly into the database at startup, for dev and demo purposes
// run with: npx prisma db seed (configured in package.json under "prisma.seed", requires ts-node - already installed)
// adapted from Christophe's seed on feat(TR-38)/sidebar - task categories corrected below
// to match the team-decided default list (see summary.tsx mock + Notion), his version
// still had an earlier draft list.

// note: everything else (form placeholders, empty state messages, input hints)
// is handled in the frontend with the HTML "placeholder" attribute - no DB needed for that
import "dotenv/config";
import {
  PrismaClient,
  ProjectStatus,
  ProjectMemberRole,
  TaskStatus,
  TaskPriority,
} from "@prisma/client";
import { computeDiscoveryBlockStatus } from "../src/discovery-blocks/discovery-block-status.util";

const prisma = new PrismaClient();

// every seeded user shares this password, so anyone on the team can log in
// locally as "andrei@42.fr" / SEED_PASSWORD, etc. - only for local dev, never
// for anything resembling a real deployment
const SEED_PASSWORD = "SeedPassword123!";

// the Go auth service rate-limits /auth/register to 5 requests per IP per
// rolling 60s window (auth/internal/server/server.go's registerIPLimiter) -
// seeding more than that in a tight loop trips it, so this pauses just past
// the window once the limit is reached instead of registering all seed
// users in one burst
const REGISTER_REQUESTS_PER_MINUTE = 5;
let registrationsInCurrentWindow = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// register a user through the real Go auth service (not prisma.user.create)
// so the account is actually loggable - auth.register() creates the User row
// itself, plus the AuthIdentity/PasswordCredential rows the seed has no
// business writing to directly (argon2id hashing lives in the auth service).
// AUTH_SERVICE_URL comes from docker-compose env (internal network address,
// ex: http://auth:3001) - Origin must match APP_ORIGIN or the auth service
// rejects the request (same check a real browser request goes through).
async function registerSeedUser(email: string, username: string) {
  if (registrationsInCurrentWindow >= REGISTER_REQUESTS_PER_MINUTE) {
    await sleep(61_000);
    registrationsInCurrentWindow = 0;
  }
  registrationsInCurrentWindow = registrationsInCurrentWindow + 1;

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
    { username: "emptyuser", campus: "42 Void"}
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
          // first member of each project = OWNER (arbitrary "creator" convention for seed
          // data only, matching ProjectsService.create's creator assignment)
          create: p.members.map((u, index) => ({
            userId: u.id,
            role: index === 0 ? ProjectMemberRole.OWNER : ProjectMemberRole.MEMBER,
          })),
        },
      },
    });
    createdProjects.push(project);
  }

  // 3. Default Discovery Blocks (on every project)
  const discoveryCategories = [
    {
      title: "PDF Project Understanding",
      icon: "search",
      color: 0,
      items: [
        "Read the subject PDF fully",
        "List every mandatory requirement",
      ],
    },
    {
      title: "Constraints",
      icon: "layers",
      color: 1,
      items: [
        "Identify technical constraints (allowed libs, languages)",
        "Identify norm/style constraints",
      ],
    },
    {
      title: "Questions",
      icon: "palette",
      color: 2,
      items: [
        "List open questions for the team",
        "List questions to ask evaluators",
      ],
    },
    {
      title: "Roadmap",
      icon: "link",
      color: 3,
      items: ["Draft a rough milestone plan", "Assign first tasks to teammates"],
    },
    {
      title: "Resources",
      icon: "notebook",
      color: 4,
      items: ["Collect useful docs/links", "Bookmark similar past projects"],
    },
    {
      title: "Concepts",
      icon: "wheel",
      color: 5,
      items: [
        "List unfamiliar concepts to learn",
        "Find a resource for each concept",
      ],
    },
  ];

  for (const project of createdProjects) {
    for (const cat of discoveryCategories) {
      // every seeded item starts unchecked, so this is always NOT_STARTED
      // today - computed via the same function DiscoveryBlocksService uses
      // (not hardcoded) so seeded data can't drift from the real rule
      const seedItems = cat.items.map((label, index) => {
        return { label: label, order: index, isChecked: false };
      });
      await prisma.discoveryBlock.create({
        data: {
          projectId: project.id,
          title: cat.title,
          icon: cat.icon,
          color: cat.color,
          status: computeDiscoveryBlockStatus(seedItems),
          discoveryBlockItems: {
            create: seedItems,
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
  
function getRandomInt(max) {
  return Math.floor(Math.random() * max) + 1;
}

  // 5. Demo project: dogfooding this planner to build the actual 42 subject.
  // A separate section rather than folded into the generic loops above -
  // this project's Discovery/Kanban content is specific to it (pulled from
  // the real subject, en.subject.pdf v21.1), not the same placeholder
  // categories every other seeded project gets.
  const demoTeamUsersData = [
    { username: "marvin", campus: "42 Paris" },
    { username: "arthur", campus: "42 London" },
    { username: "zaphod", campus: "42 Heidelberg" },
    { username: "trillian", campus: "42 Malaga" },
    { username: "ford", campus: "42 Berlin" },
  ];

  for (const u of demoTeamUsersData) {
    const email = `${u.username}@42.fr`;
    const userId = await registerSeedUser(email, u.username);
    createdUsers[u.username] = await prisma.user.update({
      where: { id: userId },
      data: { campus: u.campus },
    });
  }

  const { marvin, arthur, zaphod, trillian, ford } = createdUsers;
  const demoTeamUsers = [marvin, arthur, zaphod, trillian, ford];

  // NOT a Pong game: this team's actual ft_transcendence choice is a
  // Trello-like collaborative project management app - literally this
  // codebase (see project-transcendence.md) - so the demo project below
  // describes building THIS app, not the more common Pong pick.
  const demoProject = await prisma.project.create({
    data: {
      name: "ft_transcendence",
      description:
        "A Trello-like collaborative project management app for 42 students - built with the exact tool you're using right now",
      status: ProjectStatus.IN_PROGRESS,
      members: {
        create: demoTeamUsers.map((u, index) => ({
          userId: u.id,
          role:
            index === 0 ? ProjectMemberRole.OWNER : ProjectMemberRole.MEMBER,
        })),
      },
    },
  });

  // Discovery content mirrors what a real team would note down after a first
  // read of the subject - some items checked, some not, so the 6 blocks land
  // on a mix of NOT_STARTED/IN_PROGRESS/COMPLETED via computeDiscoveryBlockStatus.
  const demoDiscoveryCategories = [
    {
      title: "PDF Project Understanding",
      icon: "search",
      color: 0,
      items: [
        { label: "Read the full subject (v21.1)", isChecked: true },
        {
          label: "Understand mandatory part vs modules split",
          isChecked: true,
        },
        {
          label: "Review the AI usage rules and README AI section",
          isChecked: true,
        },
        {
          label: "Re-read Team Organization / required roles",
          isChecked: false,
        },
      ],
    },
    {
      title: "Constraints",
      icon: "layers",
      color: 1,
      items: [
        { label: "Frontend + backend + database required", isChecked: true },
        { label: "Single-command Docker deployment", isChecked: true },
        {
          label: "No warnings/errors in the browser console",
          isChecked: false,
        },
        {
          label:
            "Privacy Policy + Terms of Service (real content, not placeholders)",
          isChecked: false,
        },
        {
          label: "HTTPS on every browser-to-backend connection",
          isChecked: false,
        },
        {
          label: "Multi-user: concurrent actions, no race conditions",
          isChecked: false,
        },
      ],
    },
    {
      title: "Questions",
      icon: "palette",
      color: 2,
      items: [
        {
          label: "Who takes PO / PM / Tech Lead with only 5 of us?",
          isChecked: true,
        },
        {
          label: "How far do we push real-time collaboration (live shared boards)?",
          isChecked: false,
        },
        {
          label: "Is WAF/ModSecurity + Vault worth the setup cost for 2pts?",
          isChecked: false,
        },
      ],
    },
    {
      title: "Roadmap",
      icon: "link",
      color: 3,
      items: [
        {
          label:
            "Target 23 pts: Web(13) + User Mgmt(7) + Accessibility(1) + Cybersecurity(2)",
          isChecked: true,
        },
        {
          label: "MVP: auth + projects + tasks CRUD before real-time",
          isChecked: true,
        },
        {
          label: "Real-time board updates + notifications once CRUD is stable",
          isChecked: false,
        },
        { label: "Last stretch: polish, README, defense prep", isChecked: false },
      ],
    },
    {
      title: "Resources",
      icon: "notebook",
      color: 4,
      items: [
        { label: "Subject PDF (en.subject.pdf, v21.1)", isChecked: true },
        { label: "NestJS + Socket.io + Prisma docs", isChecked: false },
        {
          label: "HashiCorp Vault + WAF/ModSecurity docs",
          isChecked: false,
        },
      ],
    },
    {
      title: "Concepts",
      icon: "wheel",
      color: 5,
      items: [
        {
          label: "WebSockets for real-time board/task updates",
          isChecked: false,
        },
        {
          label: "OAuth 2.0 authorization flow (42 + Google)",
          isChecked: false,
        },
        { label: "Password hashing and salting", isChecked: true },
      ],
    },
  ];

  for (const cat of demoDiscoveryCategories) {
    const seedItems = cat.items.map((item, index) => {
      return { label: item.label, order: index, isChecked: item.isChecked };
    });
    await prisma.discoveryBlock.create({
      data: {
        projectId: demoProject.id,
        title: cat.title,
        icon: cat.icon,
        color: cat.color,
        status: computeDiscoveryBlockStatus(seedItems),
        discoveryBlockItems: {
          create: seedItems,
        },
      },
    });
  }

  // reuses the same 8 default category names/colors as every other project,
  // captured by name here so the tasks below can reference the right id
  const demoTaskCategories: Record<
    string,
    Awaited<ReturnType<typeof prisma.taskCategory.create>>
  > = {};
  for (const cat of taskCategories) {
    demoTaskCategories[cat.name] = await prisma.taskCategory.create({
      data: {
        projectId: demoProject.id,
        name: cat.name,
        color: cat.color,
      },
    });
  }

  // broad strokes only - a synthesis of the team's real board (not a 1:1
  // copy): ex. the real board tracks 8 separate "Auth 7.1..7.8" cards, here
  // that's collapsed into 2 lines (foundation done, OAuth/session hardening
  // still open); the 6 real per-tab cards (Discovery/Kanban/Calendar/...)
  // stay grouped but condensed rather than one task per tab per sub-feature
  const demoTasks = [
    {
      title: "Define team roles (PO/PM/Tech Lead/Devs)",
      category: "Planning",
      status: TaskStatus.COMPLETED,
      priority: TaskPriority.HIGH,
      assignees: [marvin],
    },
    {
      title: "Choose module combo (target 23 points)",
      category: "Planning",
      status: TaskStatus.COMPLETED,
      priority: TaskPriority.HIGH,
      assignees: [marvin, arthur],
    },
    {
      title: "Seed the app with demo data prepared for defense",
      category: "Planning",
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      assignees: [marvin],
    },
    {
      title: "Backend scaffold (NestJS + Prisma ORM)",
      category: "Backend",
      status: TaskStatus.COMPLETED,
      priority: TaskPriority.HIGH,
      assignees: [ford],
    },
    {
      title: "Vault-backed secrets + dynamic DB credentials",
      category: "Backend",
      status: TaskStatus.COMPLETED,
      priority: TaskPriority.HIGH,
      assignees: [ford],
    },
    {
      title: "Basic auth: sessions + password hashing",
      category: "Backend",
      status: TaskStatus.COMPLETED,
      priority: TaskPriority.HIGH,
      assignees: [trillian],
    },
    {
      title: "Account/identity data model: roles, project ownership",
      category: "Backend",
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      assignees: [trillian],
    },
    {
      title: "OAuth (42 + Google) and JWT session hardening",
      category: "Backend",
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      assignees: [zaphod],
    },
    {
      title: "Frontend foundations (router, layout, header/sidebar/footer)",
      category: "Frontend",
      status: TaskStatus.COMPLETED,
      priority: TaskPriority.HIGH,
      assignees: [trillian],
    },
    {
      title: "Projects List + Create Project",
      category: "Frontend",
      status: TaskStatus.REVIEW,
      priority: TaskPriority.MEDIUM,
      assignees: [arthur],
    },
    {
      title: "Discovery tab (subject breakdown checklist)",
      category: "Frontend",
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.MEDIUM,
      assignees: [marvin],
    },
    {
      title: "Kanban tab (drag-and-drop task board)",
      category: "Frontend",
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.MEDIUM,
      assignees: [arthur],
    },
    {
      title: "Calendar tab",
      category: "Frontend",
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.MEDIUM,
      assignees: [zaphod],
    },
    {
      title: "Evaluation Checklist tab",
      category: "Frontend",
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.MEDIUM,
      assignees: [ford],
    },
    {
      title: "Login/Signup, Password Reset, 2FA UI",
      category: "Frontend",
      status: TaskStatus.TODO,
      priority: TaskPriority.HIGH,
      assignees: [trillian],
    },
    {
      title: "Docker Compose, single-command deploy",
      category: "DevOps",
      status: TaskStatus.COMPLETED,
      priority: TaskPriority.HIGH,
      assignees: [ford],
    },
    {
      title: "Privacy Policy + Terms of Service pages",
      category: "Documentation",
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      assignees: [marvin],
    },
    {
      title: "Final README pass: modules justification",
      category: "Documentation",
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      assignees: [marvin],
    },
  ];

  // rank has no real ordering consumer yet on either side (grep confirmed) -
  // just needs a value, incremented per category so it's at least coherent
  const demoTaskRankByCategory: Record<string, number> = {};
  for (const t of demoTasks) {
    const rank = demoTaskRankByCategory[t.category] ?? 0;
    demoTaskRankByCategory[t.category] = rank + 1;

    await prisma.task.create({
      data: {
        projectId: demoProject.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        categoryId: demoTaskCategories[t.category].id,
        rank: rank,
        onCalendar: false,
        assignees: {
          create: t.assignees.map((u) => ({ userId: u.id })),
        },
      },
    });
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
