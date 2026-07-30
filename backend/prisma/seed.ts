// seed = inject demo data directly into the database at startup, for dev and demo purposes
// run with: npx prisma db seed (configured in package.json under "prisma.seed", requires ts-node - already installed)
// adapted from an earlier version of this seed on feat(TR-38)/sidebar - task categories corrected below
// to match the team-decided default list (see summary.tsx mock + Notion), that version
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
  EvaluationChecklistItemSection,
} from "@prisma/client";
import { computeDiscoveryBlockStatus } from "../src/discovery-blocks/discovery-block-status.util";
import { DEFAULT_CALENDAR_CATEGORIES } from "../src/calendar-categories/default-calendar-categories";

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
const REGISTER_REQUESTS_PER_MINUTE = 20;
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
    { username: "emptyuser", campus: "42 Void" }
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

  // 4b. Calendar categories ("labels"). These fake projects were created
  // with a raw prisma.project.create(), which skips ProjectsService.create()
  // (the code that normally seeds these for real projects) - so add them
  // here too, importing the same list rather than duplicating it.
  for (const project of createdProjects) {
    for (const cat of DEFAULT_CALENDAR_CATEGORIES) {
      await prisma.calendarCategory.create({
        data: {
          projectId: project.id,
          name: cat.name,
          color: cat.color,
        },
      });
    }
  }

// 5. Evaluation checklist items - hardcoded lorem-ipsum-style goals, picked
// at random for each seeded checklist item, not real evaluation criteria,
// just placeholder text
function getRandomInt(max: number): number {
  return Math.floor(Math.random() * max) + 1;
}

const GOALS = [
  "Explain the purpose of the project clearly",
  "Demonstrate a working build from a clean clone",
  "Handle edge cases without crashing",
  "Justify the chosen architecture",
  "Show proper error handling throughout",
  "Respect the mandatory coding norm",
  "Provide a clear and complete README",
  "Answer questions about any part of the code",
  "Demonstrate memory is properly freed",
  "Show that the program compiles without warnings",
  "Walk through the main data structures used",
  "Prove the program handles invalid input gracefully",
  "Explain any tradeoffs made during development",
  "Demonstrate the feature works end to end",
  "Show test coverage for critical paths",
  "Justify third-party libraries used, if any",
  "Explain how concurrency issues were avoided",
  "Demonstrate the UI matches the requested behavior",
  "Show that the program does not leak file descriptors",
  "Explain the git history and commit structure",
  "Demonstrate recovery from a simulated failure",
  "Show that inputs are properly validated",
  "Explain how the team split the workload",
  "Demonstrate the bonus feature in action",
  "Justify any deviation from the subject",
  "Show the program respects the given constraints",
  "Explain the algorithm complexity where relevant",
  "Demonstrate proper use of version control branches",
  "Show that secrets are never committed to the repo",
  "Explain how the project could be extended further",
  "Demonstrate the CI pipeline runs on every push",
  "Explain the database schema and its relationships",
  "Show that migrations run cleanly on a fresh database",
  "Justify the choice of framework or language",
  "Demonstrate graceful shutdown of all services",
  "Explain how logging is structured and where logs go",
  "Show that rate limiting is enforced where needed",
  "Demonstrate the app works without an internet connection, if applicable",
  "Explain how configuration and environment variables are managed",
  "Show that the app respects the required container setup",
  "Demonstrate horizontal scaling of a given service",
  "Explain the authentication and authorization flow",
  "Show that passwords are never stored in plaintext",
  "Demonstrate input sanitization against injection attacks",
  "Explain how sessions are managed and invalidated",
  "Show that the app handles network failures gracefully",
  "Demonstrate the retry/backoff strategy for external calls",
  "Explain the caching strategy and its invalidation rules",
  "Show that the API is documented and up to date",
  "Demonstrate backward compatibility of the API",
  "Explain how errors are reported and monitored in production",
  "Show that the test suite runs in CI without flakiness",
  "Demonstrate unit tests cover the critical business logic",
  "Explain the integration test strategy",
  "Show that the code follows the team's style guide",
  "Demonstrate a code review process was followed",
  "Explain how technical debt was tracked and addressed",
  "Show that the project meets accessibility requirements",
  "Demonstrate responsive design across screen sizes",
  "Explain how internationalization is handled, if applicable",
  "Show that the app degrades gracefully under high load",
  "Demonstrate proper handling of concurrent writes",
  "Explain the chosen data consistency model",
  "Show that backups and restores work correctly",
  "Demonstrate the disaster recovery plan",
  "Explain how secrets and credentials are rotated",
  "Show that dependencies are kept up to date",
  "Demonstrate a security audit was performed",
  "Explain the threat model considered during design",
  "Show that the app logs security-relevant events",
  "Demonstrate two-factor authentication, if implemented",
  "Explain how user data privacy is protected",
  "Show that the project complies with the subject's mandatory part",
  "Demonstrate at least one bonus module in action",
  "Explain the reasoning behind the chosen bonus modules",
  "Show that the defense demo covers all major features",
  "Demonstrate the team can answer questions on any teammate's code",
  "Explain how work was distributed and tracked across the team",
  "Show that the project builds reproducibly on another machine",
  "Demonstrate the app handles simultaneous multi-user sessions",
];

function getRandomGoal() {
  return GOALS[getRandomInt(GOALS.length) - 1];
}

  for (const project of createdProjects) {

    let s: EvaluationChecklistItemSection = EvaluationChecklistItemSection.MANDATORY;
    let iterations = getRandomInt(8);
    for (let i = 0; i < iterations; ++i) {
      await prisma.evaluationChecklistItem.create({
        data: {
          projectId: project.id,
          section: s,
          label: getRandomGoal(),
          order: i
        }
      });
    }

    s = EvaluationChecklistItemSection.BONUS;
    iterations = getRandomInt(8);
    for (let i = 0; i < iterations; ++i) {
      await prisma.evaluationChecklistItem.create({
        data: {
          projectId: project.id,
          section: s,
          label: getRandomGoal(),
          order: i
        }
      });
    }

    s = EvaluationChecklistItemSection.SUPPLEMENTAL;
    iterations = getRandomInt(8);
    for (let i = 0; i < iterations; ++i) {
      await prisma.evaluationChecklistItem.create({
        data: {
          projectId: project.id,
          section: s,
          label: getRandomGoal(),
          order: i
        }
      });
    }
  }
  
  // 6. Demo project: dogfooding this planner to build the actual 42 subject.
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
      description:
        "First pass over the subject PDF (v21.1), covering scope, constraints, and what counts as 0 points.",
      notes:
        "Any module that isn't fully working counts as 0, no partial credit. Keep that in mind when we tick modules as 'done' anywhere in this app.",
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
          label: "Re-read Team Organization and required roles",
          isChecked: false,
        },
        {
          label: "Read the Readme Requirements chapter, all required README sections",
          isChecked: false,
        },
      ],
    },
    {
      title: "Constraints",
      icon: "layers",
      color: 5,
      description:
        "Mandatory general and technical requirements (III.2/III.3), the ones that reject the whole project regardless of module points.",
      notes:
        "Section III.2 is explicit, missing or placeholder Privacy Policy or ToS means rejection, and non-functional or incomplete modules count as 0 points, no partial credit.",
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
          isChecked: true,
        },
        {
          label: "HTTPS on every browser-to-backend connection",
          isChecked: false,
        },
        {
          label: "Multi-user: concurrent actions, no race conditions",
          isChecked: false,
        },
        {
          label:
            "Git history: meaningful commits from all 5, clear work distribution",
          isChecked: true,
        },
        {
          label: "Latest stable Chrome compatibility, mandatory not a module",
          isChecked: false,
        },
        {
          label: ".env gitignored + .env.example provided",
          isChecked: true,
        },
        {
          label: "All forms validated both frontend and backend",
          isChecked: false,
        },
      ],
    },
    {
      title: "Questions",
      icon: "palette",
      color: 2,
      description: "Open questions the team still needs to settle before defense.",
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
        {
          label:
            "Does Project Members CRUD alone satisfy the Organization module, or do we need a real Workspace layer?",
          isChecked: false,
        },
        {
          label: "Do we ship basic Search first, or wait on the Elasticsearch attempt?",
          isChecked: false,
        },
      ],
    },
    {
      title: "Roadmap",
      icon: "link",
      color: 3,
      description: "Point target and delivery order.",
      notes:
        "14 points minimum required, capped at 19 once the 5-point bonus max is factored in (bonus only counts past the 14 mandatory, max +5). We're building toward 23 pts of modules as a buffer, priorities may still shift module by module as we approach the deadline.",
      items: [
        {
          label:
            "Target 23 pts of modules, Web(13) + User Mgmt(7) + Accessibility(1) + Cybersecurity(2), 19 max officially counts (14 mandatory + 5 bonus cap)",
          isChecked: true,
        },
        {
          label: "MVP: auth + projects + tasks CRUD before real-time",
          isChecked: false,
        },
        {
          label: "Real-time board updates and notifications once CRUD is stable",
          isChecked: false,
        },
        { label: "Last stretch: polish, README, defense prep", isChecked: false },
        {
          label:
            "Ship Task CRUD backend (tasks.service.ts), currently the biggest real gap",
          isChecked: false,
        },
        {
          label:
            "Wire NotificationBell to the real WebSocket feed once TR-57 backend lands",
          isChecked: false,
        },
      ],
    },
    {
      title: "Resources",
      icon: "notebook",
      color: 4,
      items: [
        { label: "Subject PDF (en.subject.pdf, v21.1)", isChecked: true },
        { label: "NestJS + Socket.io + Prisma docs", isChecked: true },
        {
          label: "HashiCorp Vault + WAF/ModSecurity docs",
          isChecked: false,
        },
        {
          label: "Elasticsearch docs (Search module attempt)",
          isChecked: false,
        },
      ],
    },
    {
      title: "Concepts",
      icon: "wheel",
      color: 6,
      items: [
        {
          label: "WebSockets for real-time board/task updates",
          isChecked: true,
        },
        {
          label: "OAuth 2.0 authorization flow (42 + Google)",
          isChecked: false,
        },
        { label: "Password hashing and salting", isChecked: true },
        {
          label: "Per-user Socket.io rooms for private notifications (emitToUser pattern)",
          isChecked: true,
        },
        {
          label:
            "WebSocket handshake Origin validation, Cross-Site WebSocket Hijacking, known gap not yet fixed",
          isChecked: false,
        },
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
        description: cat.description ?? null,
        notes: cat.notes ?? null,
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

  // demo project needs the same default labels as every other seeded project
  // - captured by name here (like demoTaskCategories below) so calendar
  // events can reference the right id
  const demoCalendarCategories: Record<
    string,
    Awaited<ReturnType<typeof prisma.calendarCategory.create>>
  > = {};
  for (const cat of DEFAULT_CALENDAR_CATEGORIES) {
    demoCalendarCategories[cat.name] = await prisma.calendarCategory.create({
      data: {
        projectId: demoProject.id,
        name: cat.name,
        color: cat.color,
      },
    });
  }

  // mirrors the real calendar: one entry per PR review pulled from
  // `gh pr list` history (real dates, real approvers), the 3 real planning
  // meetings from the Notion blueprint page, and the real unavailability
  // notes from that same page's "research and planning" section - all
  // mapped onto the H2G2 cast by rough role overlap, not a strict 1:1
  // identity mapping
  const demoCalendarEvents = [
    // --- PR reviews (category: Review) ---
    {
      title: "PR review: Docker Compose setup",
      category: "Review",
      start: "2026-06-19T14:00:00Z",
      end: "2026-06-19T15:00:00Z",
      assignees: [arthur, marvin],
    },
    {
      title: "PR review: Router + frontend foundations (TanStack)",
      category: "Review",
      start: "2026-06-26T14:00:00Z",
      end: "2026-06-26T15:00:00Z",
      assignees: [ford],
    },
    {
      title: "PR review: Backend scaffold (NestJS + Prisma)",
      category: "Review",
      start: "2026-07-08T14:00:00Z",
      end: "2026-07-08T15:00:00Z",
      assignees: [ford],
    },
    {
      title: "PR review: Landing page",
      category: "Review",
      start: "2026-07-12T14:00:00Z",
      end: "2026-07-12T15:00:00Z",
      assignees: [arthur],
    },
    {
      title: "PR review: Footer + Legal pages",
      category: "Review",
      start: "2026-07-15T14:00:00Z",
      end: "2026-07-15T15:00:00Z",
      assignees: [ford, marvin],
    },
    {
      title: "PR review: Local auth foundation",
      category: "Review",
      start: "2026-07-15T16:00:00Z",
      end: "2026-07-15T17:00:00Z",
      assignees: [marvin],
    },
    {
      title: "PR review: Project tabs layout + Summary",
      category: "Review",
      start: "2026-07-16T14:00:00Z",
      end: "2026-07-16T15:00:00Z",
      assignees: [arthur],
    },
    {
      title: "PR review: Sidebar",
      category: "Review",
      start: "2026-07-18T14:00:00Z",
      end: "2026-07-18T15:00:00Z",
      assignees: [marvin],
    },
    {
      title: "PR review: Shared project membership + roles",
      category: "Review",
      start: "2026-07-22T14:00:00Z",
      end: "2026-07-22T15:00:00Z",
      assignees: [marvin],
    },
    {
      title: "PR review: Vault runtime secrets foundation",
      category: "Review",
      start: "2026-07-24T14:00:00Z",
      end: "2026-07-24T15:00:00Z",
      assignees: [arthur],
    },
    {
      title: "PR review: Projects List + Create Project",
      category: "Review",
      start: "2026-07-26T14:00:00Z",
      end: "2026-07-26T15:00:00Z",
      assignees: [ford],
    },
    {
      title: "PR review: Discovery tab",
      category: "Review",
      start: "2026-07-27T14:00:00Z",
      end: "2026-07-27T15:00:00Z",
      assignees: [ford],
    },
    {
      title: "PR review: Evaluation Checklist",
      category: "Review",
      start: "2026-07-29T13:00:00Z",
      end: "2026-07-29T14:00:00Z",
      assignees: [marvin],
    },
    {
      title: "PR review: Auth persistence + project ownership",
      category: "Review",
      start: "2026-07-29T15:00:00Z",
      end: "2026-07-29T16:00:00Z",
      assignees: [arthur, marvin],
    },
    {
      title: "PR review: Enforce active account status",
      category: "Review",
      start: "2026-07-29T17:00:00Z",
      end: "2026-07-29T18:00:00Z",
      assignees: [marvin],
    },
    {
      title: "PR review: Calendar tab",
      category: "Review",
      start: "2026-07-29T20:00:00Z",
      end: "2026-07-29T21:00:00Z",
      assignees: [arthur],
    },
    // --- Meetings (category: Meeting) ---
    {
      title: "First meeting: structure, ideas, scaffolding, planning",
      category: "Meeting",
      start: "2026-06-15T10:00:00Z",
      end: "2026-06-15T12:00:00Z",
      assignees: [marvin, arthur, zaphod, trillian, ford],
    },
    {
      title: "Intermediate meeting: blockers, workload split, prep next phase",
      category: "Meeting",
      start: "2026-07-14T14:00:00Z",
      end: "2026-07-14T15:30:00Z",
      assignees: [marvin, arthur, zaphod, trillian, ford],
    },
    {
      title:
        "Control meeting, 10 days before eval: status check, modules validated, gaps, deprioritize or abandon calls",
      category: "Meeting",
      start: "2026-08-01T10:00:00Z",
      end: "2026-08-01T12:00:00Z",
      assignees: [marvin, arthur, zaphod, trillian, ford],
    },
    // --- Unavailabilities (category: Unavailabilities) ---
    {
      title: "Unavailable, not working, partially reachable by message",
      category: "Unavailabilities",
      start: "2026-06-25T00:00:00Z",
      end: "2026-06-29T23:59:00Z",
      assignees: [arthur],
    },
    {
      title: "Unavailable, not working, partially reachable by message",
      category: "Unavailabilities",
      start: "2026-07-15T00:00:00Z",
      end: "2026-07-20T23:59:00Z",
      assignees: [arthur],
    },
    {
      title: "Unavailable",
      category: "Unavailabilities",
      start: "2026-07-16T00:00:00Z",
      end: "2026-07-16T23:59:00Z",
      assignees: [zaphod],
    },
    {
      title: "Unavailable on campus, reachable by message",
      category: "Unavailabilities",
      start: "2026-06-09T00:00:00Z",
      end: "2026-06-13T23:59:00Z",
      assignees: [zaphod],
    },
    {
      title: "On and off, wedding weekend, not mine",
      category: "Unavailabilities",
      start: "2026-06-19T00:00:00Z",
      end: "2026-06-21T23:59:00Z",
      assignees: [zaphod],
    },
    {
      title: "Unavailable",
      category: "Unavailabilities",
      start: "2026-07-27T00:00:00Z",
      end: "2026-07-27T23:59:00Z",
      assignees: [zaphod],
    },
    {
      title: "Job contract shift, unavailable",
      category: "Unavailabilities",
      start: "2026-06-22T14:00:00Z",
      end: "2026-06-22T23:00:00Z",
      assignees: [marvin],
    },
    {
      title: "Job contract shift, unavailable",
      category: "Unavailabilities",
      start: "2026-06-24T12:00:00Z",
      end: "2026-06-24T20:00:00Z",
      assignees: [marvin],
    },
    {
      title: "Job contract shift, unavailable",
      category: "Unavailabilities",
      start: "2026-07-07T00:00:00Z",
      end: "2026-07-07T23:59:00Z",
      assignees: [marvin],
    },
    {
      title: "Job contract shift, unavailable",
      category: "Unavailabilities",
      start: "2026-07-08T00:00:00Z",
      end: "2026-07-08T23:59:00Z",
      assignees: [marvin],
    },
    {
      title: "Job contract shift, unavailable",
      category: "Unavailabilities",
      start: "2026-07-10T00:00:00Z",
      end: "2026-07-10T23:59:00Z",
      assignees: [marvin],
    },
    {
      title: "Job contract shift, unavailable",
      category: "Unavailabilities",
      start: "2026-07-15T14:00:00Z",
      end: "2026-07-15T23:00:00Z",
      assignees: [marvin],
    },
    {
      title: "Job contract shift, unavailable",
      category: "Unavailabilities",
      start: "2026-07-16T12:00:00Z",
      end: "2026-07-16T20:00:00Z",
      assignees: [marvin],
    },
    {
      title: "Job contract shift, unavailable",
      category: "Unavailabilities",
      start: "2026-07-17T10:00:00Z",
      end: "2026-07-17T19:00:00Z",
      assignees: [marvin],
    },
    {
      title: "Job contract shift, unavailable",
      category: "Unavailabilities",
      start: "2026-07-21T10:00:00Z",
      end: "2026-07-21T19:00:00Z",
      assignees: [marvin],
    },
    // --- Deadline / Eval ---
    {
      title: "Project deadline",
      category: "Deadline",
      start: "2026-08-08T23:59:00Z",
      end: "2026-08-08T23:59:00Z",
      assignees: [marvin, arthur, zaphod, trillian, ford],
    },
    {
      title: "Peer evaluation / defense",
      category: "Eval",
      start: "2026-08-09T10:00:00Z",
      end: "2026-08-09T12:00:00Z",
      assignees: [marvin, arthur, zaphod, trillian, ford],
    },
    {
      title: "Peer evaluation retry, in case",
      category: "Eval",
      start: "2026-08-12T10:00:00Z",
      end: "2026-08-12T12:00:00Z",
      assignees: [marvin, arthur, zaphod, trillian, ford],
    },
  ];

  for (const ev of demoCalendarEvents) {
    await prisma.calendarEvent.create({
      data: {
        projectId: demoProject.id,
        title: ev.title,
        startAt: new Date(ev.start),
        endAt: new Date(ev.end),
        categoryId: demoCalendarCategories[ev.category].id,
        assignees: {
          create: ev.assignees.map((u) => ({ userId: u.id })),
        },
      },
    });
  }

  // mirrors the real Task Rabbit Notion board (kanban database under the
  // team's Transcendence page), mapped onto the H2G2 cast, plus the 3
  // optional Devops modules from the "Module selection + stack proposition"
  // page's Optional items table (ELK, Prometheus/Grafana, health check + DR)
  // added as their own option tickets instead of one grouped card
  const demoTasks = [
    {
      title: "Define team roles (PO/PM/Tech Lead/Devs)",
      category: "Planning",
      status: TaskStatus.COMPLETED,
      priority: TaskPriority.HIGH,
      assignees: [marvin],
      notes: "Roles locked early, PO/PM/Tech Lead plus 2 devs since we're 5.",
    },
    {
      title: "Choose module combo (target 23 pts, 19 max counts)",
      category: "Planning",
      status: TaskStatus.COMPLETED,
      priority: TaskPriority.HIGH,
      assignees: [marvin, arthur],
      notes:
        "Picked modules to comfortably clear 14, capped bonus reminder kept in the discovery block.",
    },
    {
      title: "Seed the app with demo data prepared for defense",
      category: "Planning",
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      assignees: [marvin],
      notes: "This exact task, seeding realistic data across every tab before the defense.",
    },
    {
      title: "Vault-backed secrets + dynamic DB credentials",
      category: "Backend",
      status: TaskStatus.COMPLETED,
      priority: TaskPriority.HIGH,
      assignees: [ford],
      notes: "AppRole leases short-lived DB credentials instead of a static password.",
    },
    {
      title: "Basic auth: sessions + password hashing",
      category: "Backend",
      status: TaskStatus.COMPLETED,
      priority: TaskPriority.HIGH,
      assignees: [trillian],
      notes: "Argon2id hashing, HttpOnly session cookie, CSRF token.",
    },
    {
      title: "Account/identity data model: roles, project ownership",
      category: "Backend",
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      assignees: [trillian],
      notes: "Extending the user model for account status and ownership rules.",
    },
    {
      title: "Enforce account status in current auth path",
      category: "Backend",
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      assignees: [trillian],
      notes: "Blocking login for suspended or disabled accounts at the auth layer.",
    },
    {
      title: "Shared project membership check + role field",
      category: "Backend",
      status: TaskStatus.COMPLETED,
      priority: TaskPriority.MEDIUM,
      assignees: [ford],
      notes:
        "One assertMembership helper reused by every module instead of duplicated checks.",
    },
    {
      title: "Websocket Layer + Notification System",
      category: "Backend",
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      assignees: [zaphod],
      notes: "Realtime gateway and per-user rooms are up, notification persistence next.",
    },
    {
      title: "OAuth (42 + Google) and JWT session hardening",
      category: "Backend",
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      assignees: [zaphod],
      notes: "Covers 42 and Google login plus refresh token rotation.",
    },
    {
      title: "Public API: API-key discovery and design",
      category: "Backend",
      status: TaskStatus.TODO,
      priority: TaskPriority.HIGH,
      assignees: [ford],
      notes: "Deciding how API keys are issued and rate limited before building it.",
    },
    {
      title: "Frontend foundations (router, layout, header/sidebar/footer)",
      category: "Frontend",
      status: TaskStatus.COMPLETED,
      priority: TaskPriority.HIGH,
      assignees: [trillian],
      notes: "Router, shared layout, and the three chrome components.",
    },
    {
      title: "Projects List + Create Project",
      category: "Frontend",
      status: TaskStatus.COMPLETED,
      priority: TaskPriority.MEDIUM,
      assignees: [arthur],
      notes: "In place card that morphs into a create form, no modal.",
    },
    {
      title: "Discovery tab",
      category: "Frontend",
      status: TaskStatus.COMPLETED,
      priority: TaskPriority.MEDIUM,
      assignees: [marvin],
      notes: "Checklist blocks with notes, colors, and icons per category.",
    },
    {
      title: "Kanban tab (drag-and-drop task board)",
      category: "Frontend",
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.MEDIUM,
      assignees: [arthur],
      notes: "Drag and drop ordering across the four status columns.",
    },
    {
      title: "Calendar tab",
      category: "Frontend",
      status: TaskStatus.COMPLETED,
      priority: TaskPriority.MEDIUM,
      assignees: [zaphod],
      notes: "Month view with category labels and event drawer.",
    },
    {
      title: "Evaluation Checklist tab",
      category: "Frontend",
      status: TaskStatus.COMPLETED,
      priority: TaskPriority.MEDIUM,
      assignees: [ford],
      notes: "Mandatory, bonus, and supplemental sections with per item notes.",
    },
    {
      title: "Project Settings tab",
      category: "Frontend",
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      assignees: [arthur],
      notes: "Member add and remove, plus role changes for the project.",
    },
    {
      title: "User Settings page",
      category: "Frontend",
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.MEDIUM,
      assignees: [trillian],
      notes: "Profile info, avatar upload, and account preferences.",
    },
    {
      title: "Summary tab wired to real data",
      category: "Frontend",
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.MEDIUM,
      assignees: [ford],
      notes: "Swapping each mock widget for real data as its feature lands.",
    },
    {
      title: "Friends feature, chat, and public profile viewing",
      category: "Frontend",
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.MEDIUM,
      assignees: [marvin],
      notes: "Add and remove friends, basic DMs, and a read only profile page.",
    },
    {
      title: "Login/Signup, Password Reset, 2FA UI",
      category: "Frontend",
      status: TaskStatus.TODO,
      priority: TaskPriority.HIGH,
      assignees: [trillian],
      notes: "Auth screens beyond the existing modal, plus password reset and 2FA.",
    },
    {
      title: "Docker Compose, single-command deploy",
      category: "DevOps",
      status: TaskStatus.COMPLETED,
      priority: TaskPriority.HIGH,
      assignees: [ford],
      notes: "make up-build brings up the whole stack in one command.",
    },
    {
      title: "Infrastructure for log management (ELK), option",
      category: "DevOps",
      status: TaskStatus.TODO,
      priority: TaskPriority.LOW,
      assignees: [ford],
      notes:
        "ELK stack bonus module, only worth the setup cost if it stays stable through the defense.",
    },
    {
      title: "Monitoring system with Prometheus and Grafana, option",
      category: "DevOps",
      status: TaskStatus.TODO,
      priority: TaskPriority.LOW,
      assignees: [ford],
      notes: "Bonus module, dashboards and alerting layered on the existing stack.",
    },
    {
      title: "Health check and status page + DR, option",
      category: "DevOps",
      status: TaskStatus.TODO,
      priority: TaskPriority.LOW,
      assignees: [ford],
      notes: "Bonus module, keeps the team working if a dependency like Elasticsearch goes down.",
    },
    {
      title: "Privacy Policy + Terms of Service pages",
      category: "Documentation",
      status: TaskStatus.COMPLETED,
      priority: TaskPriority.MEDIUM,
      assignees: [marvin],
      notes: "Real content, not placeholders, linked from the footer.",
    },
    {
      title: "Final README pass: modules justification",
      category: "Documentation",
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      assignees: [marvin],
      notes: "Explaining each chosen module and individual contributions.",
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
        notes: t.notes,
        onCalendar: false,
        assignees: {
          create: t.assignees.map((u) => ({ userId: u.id })),
        },
      },
    });
  }

  // one zero-duration "Dev" calendar entry per task that moved into the WIP
  // column on the real board, marking the day it started rather than a real
  // work block (the app supports a zero-duration event for exactly this kind
  // of reminder marker)
  const demoTaskWipDates: Record<string, string> = {
    "Kanban tab (drag-and-drop task board)": "2026-07-25T00:00:00Z",
    "Summary tab wired to real data": "2026-07-26T00:00:00Z",
    "Account/identity data model: roles, project ownership": "2026-07-27T00:00:00Z",
    "Project Settings tab": "2026-07-28T00:00:00Z",
    "Enforce account status in current auth path": "2026-07-29T00:00:00Z",
    "User Settings page": "2026-07-29T00:00:00Z",
    "Websocket Layer + Notification System": "2026-07-30T00:00:00Z",
    "Friends feature, chat, and public profile viewing": "2026-07-30T00:00:00Z",
  };

  for (const t of demoTasks) {
    const wipDate = demoTaskWipDates[t.title];
    if (!wipDate) {
      continue;
    }
    await prisma.calendarEvent.create({
      data: {
        projectId: demoProject.id,
        title: t.title,
        startAt: new Date(wipDate),
        endAt: new Date(wipDate),
        categoryId: demoCalendarCategories["Dev"].id,
        assignees: {
          create: t.assignees.map((u) => ({ userId: u.id })),
        },
      },
    });
  }

  // Evaluation Checklist, grounded in the real target module list (Module
  // selection + stack proposition Notion page) and the subject's own
  // mandatory general/technical requirements, not placeholder text.
  // MANDATORY covers everything graded: the 14-point core module target
  // plus the subject's non-point general/technical requirements, both
  // reject the whole project if missed. BONUS holds the rest of the
  // 23-point plan plus the 3 real Devops "Optional items" from that same
  // page, bonus only counts past the 14 mandatory and caps at +5.
  // SUPPLEMENTAL is outside grading entirely: stretch goals for the app to
  // outlive the school project (real deployment, real users).
  const demoEvaluationChecklistItems: {
    section: EvaluationChecklistItemSection;
    label: string;
    isChecked: boolean;
  }[] = [
    // MANDATORY, target 14 pts
    {
      section: EvaluationChecklistItemSection.MANDATORY,
      label: "Framework: frontend (React) and backend (NestJS), Major, 2pts",
      isChecked: true,
    },
    {
      section: EvaluationChecklistItemSection.MANDATORY,
      label: "Use an ORM for the database (Prisma), Minor, 1pt",
      isChecked: true,
    },
    {
      section: EvaluationChecklistItemSection.MANDATORY,
      label: "Real-time features using WebSockets, Major, 2pts",
      isChecked: false,
    },
    {
      section: EvaluationChecklistItemSection.MANDATORY,
      label: "Complete notification system, Minor, 1pt",
      isChecked: false,
    },
    {
      section: EvaluationChecklistItemSection.MANDATORY,
      label: "Real-time collaborative features, shared boards, Minor, 1pt",
      isChecked: false,
    },
    {
      section: EvaluationChecklistItemSection.MANDATORY,
      label: "Standard user management and authentication, Major, 2pts",
      isChecked: false,
    },
    {
      section: EvaluationChecklistItemSection.MANDATORY,
      label: "User interaction: chat, profile, friends, Major, 2pts",
      isChecked: false,
    },
    {
      section: EvaluationChecklistItemSection.MANDATORY,
      label: "Advanced permissions system, Major, 2pts",
      isChecked: false,
    },
    {
      section: EvaluationChecklistItemSection.MANDATORY,
      label: "Advanced search with filters, sorting, pagination, Minor, 1pt",
      isChecked: false,
    },
    // BONUS, rest of the 23pt plan plus the real Devops optional items, only
    // 5pts of this ever count officially
    {
      section: EvaluationChecklistItemSection.BONUS,
      label: "Public API, secured API key, rate limiting, 5+ endpoints, Major, 2pts",
      isChecked: false,
    },
    {
      section: EvaluationChecklistItemSection.BONUS,
      label: "An organization system, Major, 2pts",
      isChecked: false,
    },
    {
      section: EvaluationChecklistItemSection.BONUS,
      label: "Remote authentication with OAuth 2.0, Minor, 1pt",
      isChecked: false,
    },
    {
      section: EvaluationChecklistItemSection.BONUS,
      label: "Support for additional browsers, Minor, 1pt",
      isChecked: false,
    },
    {
      section: EvaluationChecklistItemSection.BONUS,
      label: "File upload and management system, Minor, 1pt",
      isChecked: false,
    },
    {
      section: EvaluationChecklistItemSection.BONUS,
      label: "WAF/ModSecurity plus HashiCorp Vault, Major, 2pts",
      isChecked: false,
    },
    {
      section: EvaluationChecklistItemSection.BONUS,
      label: "Infrastructure for log management, ELK, option, Major, 2pts",
      isChecked: false,
    },
    {
      section: EvaluationChecklistItemSection.BONUS,
      label: "Monitoring system with Prometheus and Grafana, option, Major, 2pts",
      isChecked: false,
    },
    {
      section: EvaluationChecklistItemSection.BONUS,
      label: "Health check and status page plus DR, option, Minor, 1pt",
      isChecked: false,
    },
    // MANDATORY, non-point general/technical requirements, reject the whole
    // project if missed regardless of module score
    {
      section: EvaluationChecklistItemSection.MANDATORY,
      label: "Frontend, backend, and database, web application",
      isChecked: true,
    },
    {
      section: EvaluationChecklistItemSection.MANDATORY,
      label: "Single-command Docker deployment",
      isChecked: true,
    },
    {
      section: EvaluationChecklistItemSection.MANDATORY,
      label: "Git history: meaningful commits from all 5, clear work distribution",
      isChecked: true,
    },
    {
      section: EvaluationChecklistItemSection.MANDATORY,
      label: "Latest stable Chrome compatibility verified",
      isChecked: false,
    },
    {
      section: EvaluationChecklistItemSection.MANDATORY,
      label: "No warnings or errors in the browser console",
      isChecked: false,
    },
    {
      section: EvaluationChecklistItemSection.MANDATORY,
      label: "Privacy Policy and Terms of Service, real content",
      isChecked: true,
    },
    {
      section: EvaluationChecklistItemSection.MANDATORY,
      label: "Multi-user: concurrent actions handled, no race conditions",
      isChecked: false,
    },
    {
      section: EvaluationChecklistItemSection.MANDATORY,
      label:
        "README complete: team roles, stack, schema, features, modules, individual contributions",
      isChecked: false,
    },
    {
      section: EvaluationChecklistItemSection.MANDATORY,
      label: "Ready to explain role split and individual contributions live",
      isChecked: false,
    },
    // SUPPLEMENTAL, outside grading entirely: stretch goals for the app to
    // outlive the school project
    {
      section: EvaluationChecklistItemSection.SUPPLEMENTAL,
      label: "Deploy on a real VPS instead of local Docker only",
      isChecked: false,
    },
    {
      section: EvaluationChecklistItemSection.SUPPLEMENTAL,
      label: "Buy and set up a real domain name for the app",
      isChecked: false,
    },
    {
      section: EvaluationChecklistItemSection.SUPPLEMENTAL,
      label: "Open the app to real 42 students as a shared tool, in the spirit of 42 Friends",
      isChecked: false,
    },
    {
      section: EvaluationChecklistItemSection.SUPPLEMENTAL,
      label: "Seed real projects with genuinely useful content, not just the defense demo",
      isChecked: false,
    },
    {
      section: EvaluationChecklistItemSection.SUPPLEMENTAL,
      label: "Build an admin panel for managing users and reported content",
      isChecked: false,
    },
    {
      section: EvaluationChecklistItemSection.SUPPLEMENTAL,
      label: "Public roadmap or feedback page for real users",
      isChecked: false,
    },
    {
      section: EvaluationChecklistItemSection.SUPPLEMENTAL,
      label: "Uptime monitoring and backups for a real deployment",
      isChecked: false,
    },
    {
      section: EvaluationChecklistItemSection.SUPPLEMENTAL,
      label: "Custom branding: logo, favicon, and domain-matched email templates",
      isChecked: false,
    },
  ];

  const demoEvaluationChecklistOrderBySection: Record<string, number> = {};
  for (const item of demoEvaluationChecklistItems) {
    const order = demoEvaluationChecklistOrderBySection[item.section] ?? 0;
    demoEvaluationChecklistOrderBySection[item.section] = order + 1;
    await prisma.evaluationChecklistItem.create({
      data: {
        projectId: demoProject.id,
        section: item.section,
        label: item.label,
        isChecked: item.isChecked,
        order: order,
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
