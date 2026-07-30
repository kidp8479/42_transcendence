// Default labels every new project gets, inserted by ProjectsService.create().
// prisma/seed.ts imports this same list for the demo projects instead of
// duplicating it.
export const DEFAULT_CALENDAR_CATEGORIES: { name: string; color: number }[] = [
  { name: "Eval", color: 1 },
  { name: "Dev", color: 3 },
  { name: "Deadline", color: 5 },
  { name: "Review", color: 2 },
  { name: "Meeting", color: 6 },
  { name: "Other", color: 7 },
  { name: "Unavailabilities", color: 4 },
];
