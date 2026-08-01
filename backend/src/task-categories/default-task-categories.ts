<<<<<<< HEAD
// Default categories every new project gets, inserted by ProjectsService.create().
// prisma/seed.ts imports this same list for the demo projects instead of
// duplicating it.
=======
// Default task categories every new project gets, inserted by
// ProjectsService.create(). prisma/seed.ts imports this same list for its demo
// projects instead of duplicating it - those are created with a raw
// prisma.project.create(), which bypasses the service.
//
// NOT the same list as DEFAULT_CALENDAR_CATEGORIES: those are event labels
// (Eval, Deadline, Meeting...), these are work categories for the Kanban board.
// Team-decided, and mirrored by the Summary tab's ProgressByCategory.
//
// Bounded to 8 entries: color is an index into the frontend's
// CATEGORY_COLOR_PALETTE (lib/categoryColorPalette.ts), which has nothing past
// index 7 - see taskCategoryColorIndices in dto/create-task-category.dto.ts.
>>>>>>> 1e14176 (feat(TR-49): add backend of kanban and fix bugs in the frontend)
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
