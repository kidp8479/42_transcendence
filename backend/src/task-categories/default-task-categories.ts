// Default task categories every new project gets, inserted by
// ProjectsService.create(). prisma/seed/sample-projects.ts and
// seed/flagship-project.ts import this same list instead of duplicating it -
// they create their projects with a raw prisma.project.create(), which bypasses
// the service.
//
// NOT the same list as DEFAULT_CALENDAR_CATEGORIES: those are event labels
// (Eval, Deadline, Meeting...), these are work categories for the Kanban board.
// Team-decided, and mirrored by the Summary tab's ProgressByCategory.
//
// Bounded to 8 entries: color is an index into the frontend's
// CATEGORY_COLOR_PALETTE (lib/categoryColorPalette.ts), which has nothing past
// index 7 - see taskCategoryColorIndices in dto/create-task-category.dto.ts.
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
