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
// "/15" and "/30" opacity variants. Tailwind only generates CSS for a class it
// can see written whole in the source - a class rebuilt at runtime by joining
// strings (ex: someClass + "/15") never appears in full in the source, so
// Tailwind silently skips it and the class ends up doing nothing.
export const CATEGORY_COLOR_PALETTE = [
  {
    bg: "bg-category-0",
    border: "border-category-0",
    hoverBorder: "hover:border-category-0",
    text: "text-category-0",
    badgeBg: "bg-category-0/15",
    badgeBorder: "border-category-0/30",
  },
  {
    // index 1 reuses the brand color, matches the Figma prototype
    bg: "bg-brand-500",
    border: "border-brand-500",
    hoverBorder: "hover:border-brand-500",
    text: "text-brand-500",
    badgeBg: "bg-brand-500/15",
    badgeBorder: "border-brand-500/30",
  },
  {
    bg: "bg-category-2",
    border: "border-category-2",
    hoverBorder: "hover:border-category-2",
    text: "text-category-2",
    badgeBg: "bg-category-2/15",
    badgeBorder: "border-category-2/30",
  },
  {
    bg: "bg-category-3",
    border: "border-category-3",
    hoverBorder: "hover:border-category-3",
    text: "text-category-3",
    badgeBg: "bg-category-3/15",
    badgeBorder: "border-category-3/30",
  },
  {
    bg: "bg-category-4",
    border: "border-category-4",
    hoverBorder: "hover:border-category-4",
    text: "text-category-4",
    badgeBg: "bg-category-4/15",
    badgeBorder: "border-category-4/30",
  },
  {
    bg: "bg-category-5",
    border: "border-category-5",
    hoverBorder: "hover:border-category-5",
    text: "text-category-5",
    badgeBg: "bg-category-5/15",
    badgeBorder: "border-category-5/30",
  },
  {
    bg: "bg-category-6",
    border: "border-category-6",
    hoverBorder: "hover:border-category-6",
    text: "text-category-6",
    badgeBg: "bg-category-6/15",
    badgeBorder: "border-category-6/30",
  },
  {
    bg: "bg-category-7",
    border: "border-category-7",
    hoverBorder: "hover:border-category-7",
    text: "text-category-7",
    badgeBg: "bg-category-7/15",
    badgeBorder: "border-category-7/30",
  },
];

export type CategoryColor = (typeof CATEGORY_COLOR_PALETTE)[number];

// Looks up a category by name (used by Team Workload's tags) and returns its
// palette entry. Falls back to index 0 if the name doesn't match any known
// category, or if the matched category's color is outside the palette's
// 0-7 range (see the file-level comment above) - shouldn't happen with
// real data, but keeps this from crashing either way.
export function getCategoryColorByName(
  categories: { name: string; color: number }[],
  category_name: string
): CategoryColor {
  const found_category = categories.find(
    (category) => category.name === category_name
  );
  return (
    CATEGORY_COLOR_PALETTE[found_category?.color ?? 0] ??
    CATEGORY_COLOR_PALETTE[0]
  );
}
