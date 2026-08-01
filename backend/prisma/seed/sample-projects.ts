import {
  PrismaClient,
  ProjectStatus,
  ProjectMemberRole,
  EvaluationChecklistItemSection,
  User,
} from "@prisma/client";
import { computeDiscoveryBlockStatus } from "../../src/discovery-blocks/discovery-block-status.util";
import { DEFAULT_CALENDAR_CATEGORIES } from "../../src/calendar-categories/default-calendar-categories";
import { DEFAULT_TASK_CATEGORIES } from "../../src/task-categories/default-task-categories";
import { DEFAULT_DISCOVERY_BLOCKS } from "../../src/discovery-blocks/default-discovery-blocks";

function getRandomInt(max: number): number {
  return Math.floor(Math.random() * max) + 1;
}

// hardcoded lorem-ipsum-style goals, picked at random for each seeded
// checklist item, not real evaluation criteria, just placeholder text
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

function getRandomGoal(): string {
  return GOALS[getRandomInt(GOALS.length) - 1];
}

// Generic placeholder projects, one bunch per real user plus a couple of
// shared ones - just volume so the real seeded users have something to
// browse/paginate through. Content is interchangeable, nobody's meant to
// actually read it, unlike the flagship project.
export async function seedSampleProjects(
  prisma: PrismaClient,
  users: {
    andrei: User;
    carlos: User;
    christophe: User;
    diana: User;
    pauline: User;
  }
): Promise<void> {
  const { andrei, carlos, christophe, diana, pauline } = users;
  const allUsers = [andrei, carlos, christophe, diana, pauline];

  const projectsData = [
    {
      name: "ft_transcendence",
      description:
        "Full-stack web app with real-time multiplayer Pong game and OAuth",
      status: ProjectStatus.IN_PROGRESS,
      members: allUsers,
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
    ...allUsers.flatMap((user) => [
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

  // Default Discovery Blocks (on every project)
  for (const project of createdProjects) {
    for (const cat of DEFAULT_DISCOVERY_BLOCKS) {
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

  // Task categories. These fake projects were created with a raw
  // prisma.project.create(), which skips ProjectsService.create() (the code
  // that normally seeds these for real projects) - so add them here too,
  // importing the same list rather than duplicating it.
  for (const project of createdProjects) {
    for (const cat of DEFAULT_TASK_CATEGORIES) {
      await prisma.taskCategory.create({
        data: {
          projectId: project.id,
          name: cat.name,
          color: cat.color,
        },
      });
    }
  }

  // Calendar categories ("labels"). These fake projects were created
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

  // Evaluation checklist items - hardcoded lorem-ipsum-style goals, picked
  // at random for each seeded checklist item, not real evaluation criteria,
  // just placeholder text
  for (const project of createdProjects) {
    let s: EvaluationChecklistItemSection = EvaluationChecklistItemSection.MANDATORY;
    let iterations = getRandomInt(8);
    for (let i = 0; i < iterations; ++i) {
      await prisma.evaluationChecklistItem.create({
        data: {
          projectId: project.id,
          section: s,
          label: getRandomGoal(),
          order: i,
        },
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
          order: i,
        },
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
          order: i,
        },
      });
    }
  }
}
