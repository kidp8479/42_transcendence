// Default discovery blocks every new project gets, inserted by
// ProjectsService.create(). Unlike task/calendar categories, these are just
// a starting point, the user can delete or edit them freely afterwards.
// prisma/seed.ts imports this same list for the demo projects instead of
// duplicating it.
export const DEFAULT_DISCOVERY_BLOCKS: {
  title: string;
  icon: string;
  color: number;
  items: string[];
}[] = [
  {
    title: "PDF Project Understanding",
    icon: "search",
    color: 0,
    items: ["Read the subject PDF fully", "List every mandatory requirement"],
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
