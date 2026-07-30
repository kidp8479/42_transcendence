// Default categories every new project gets, inserted by ProjectsService.create().
// prisma/seed.ts imports this same list for the demo projects instead of
// duplicating it.
export const DEFAULT_TASK_CATEGORIES: { name: string; color: number }[] = [
  { name: "Planning", color: 0 },
  { name: "Development", color: 1 },
  { name: "Testing", color: 2 },
  { name: "Backend", color: 3 },
  { name: "Frontend", color: 4 },
  { name: "DevOps", color: 5 },
  { name: "Parsing", color: 6 },
  { name: "Documentation", color: 7 },
];
