// Default calendar labels every new project gets automatically, inserted by
// ProjectsService.create() in the same transaction as the project itself.
// Matches the Figma prototype's Label dropdown (Eval/Dev/Deadline/Review/
// Meeting/Other), plus Unavailabilities so members can flag when they're not
// available. Also the source of truth prisma/seed.ts copies for the fake
// demo projects, so the two can never drift apart.
export const DEFAULT_CALENDAR_CATEGORIES: { name: string; color: number }[] = [
  { name: "Eval", color: 1 },
  { name: "Dev", color: 3 },
  { name: "Deadline", color: 5 },
  { name: "Review", color: 2 },
  { name: "Meeting", color: 6 },
  { name: "Other", color: 7 },
  { name: "Unavailabilities", color: 4 },
];
