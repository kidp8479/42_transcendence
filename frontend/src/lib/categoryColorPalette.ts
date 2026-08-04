// Shared palette every category (task or calendar) picks from, via its color
// index (matches TaskCategory.color / CalendarCategory.color, both Int, in
// schema.prisma). Also reused for Team Workload's per-member avatar color.
//
// Bounded to 8 entries (0-7) - matches today's 8 default categories. A project
// with more than 8 categories has no defined color past index 7 yet: no
// wrap-around/modulo exists, and category creation (backend) doesn't cap the
// count either. Not fixed for now (edge case, unlikely with the current
// default list) - revisit if it becomes a real problem.
//
// Every class below is written out in full, character for character, even the
// "/15" and "/30" opacity variants AND the `hover:` prefix. Tailwind only
// generates CSS for a class it can see written whole in the source - a class
// rebuilt at runtime by joining strings (ex: someClass + "/15", or
// `hover:${entry.border}`) never appears in full in the source, so Tailwind
// silently skips it and the class ends up doing nothing. That is why
// hoverBorder exists as its own key rather than being derived from `border`.
export const CATEGORY_COLOR_PALETTE = [
  {
    bg: "bg-category-0",
    border: "border-category-0",
    text: "text-category-0",
    ring: "ring-category-0",
    badgeBg: "bg-category-0/15",
    badgeBorder: "border-category-0/30",
    subtleBg: "bg-category-0/6",
    hoverBorder: "hover:border-category-0/40",
  },
  {
    // index 1 reuses the brand color, matches the Figma prototype
    bg: "bg-brand-500",
    border: "border-brand-500",
    text: "text-brand-500",
    ring: "ring-brand-500",
    badgeBg: "bg-brand-500/15",
    badgeBorder: "border-brand-500/30",
    subtleBg: "bg-brand-500/6",
    hoverBorder: "hover:border-brand-500/40",
  },
  {
    bg: "bg-category-2",
    border: "border-category-2",
    text: "text-category-2",
    ring: "ring-category-2",
    badgeBg: "bg-category-2/15",
    badgeBorder: "border-category-2/30",
    subtleBg: "bg-category-2/6",
    hoverBorder: "hover:border-category-2/40",
  },
  {
    bg: "bg-category-3",
    border: "border-category-3",
    text: "text-category-3",
    ring: "ring-category-3",
    badgeBg: "bg-category-3/15",
    badgeBorder: "border-category-3/30",
    subtleBg: "bg-category-3/6",
    hoverBorder: "hover:border-category-3/40",
  },
  {
    bg: "bg-category-4",
    border: "border-category-4",
    text: "text-category-4",
    ring: "ring-category-4",
    badgeBg: "bg-category-4/15",
    badgeBorder: "border-category-4/30",
    subtleBg: "bg-category-4/6",
    hoverBorder: "hover:border-category-4/40",
  },
  {
    bg: "bg-category-5",
    border: "border-category-5",
    text: "text-category-5",
    ring: "ring-category-5",
    badgeBg: "bg-category-5/15",
    badgeBorder: "border-category-5/30",
    subtleBg: "bg-category-5/6",
    hoverBorder: "hover:border-category-5/40",
  },
  {
    bg: "bg-category-6",
    border: "border-category-6",
    text: "text-category-6",
    ring: "ring-category-6",
    badgeBg: "bg-category-6/15",
    badgeBorder: "border-category-6/30",
    subtleBg: "bg-category-6/6",
    hoverBorder: "hover:border-category-6/40",
  },
  {
    bg: "bg-category-7",
    border: "border-category-7",
    text: "text-category-7",
    ring: "ring-category-7",
    badgeBg: "bg-category-7/15",
    badgeBorder: "border-category-7/30",
    subtleBg: "bg-category-7/6",
    hoverBorder: "hover:border-category-7/40",
  },
];

export type CategoryColor = (typeof CATEGORY_COLOR_PALETTE)[number];

// Palette entry for a color index, falling back to index 0 when the index is
// outside the palette's 0-7 range (see the file-level comment above). The
// backend caps color at 7, so this only guards against data that predates that
// rule - but every consumer needs the same guard, so it lives here rather than
// being spelled out at each call site.
export function getCategoryColor(colorIndex: number): CategoryColor {
  return CATEGORY_COLOR_PALETTE[colorIndex] ?? CATEGORY_COLOR_PALETTE[0];
}

// Looks up a category by name (used by Team Workload's tags) and returns its
// palette entry. Falls back to index 0 if the name doesn't match any known
// category - shouldn't happen with real data, but keeps this from crashing.
export function getCategoryColorByName(
  categories: { name: string; color: number }[],
  category_name: string
): CategoryColor {
  const found_category = categories.find(
    (category) => category.name === category_name
  );
  return getCategoryColor(found_category?.color ?? 0);
}
