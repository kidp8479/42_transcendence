// See DefenseReadiness.tsx (components/summary) for an explanation of the
// pattern every component here follows: interface, props destructuring, pure
// prop-driven rendering.
//
// Category pill shown on kanban cards and in the drawer header - same badge
// recipe as Team Workload's category tags, colored by the category's palette
// index. Task.categoryId is nullable in the schema, so a null category is a
// real case and renders a muted "Uncategorized" pill.
import { CATEGORY_COLOR_PALETTE } from "@/lib/categoryColorPalette";
import type { TaskCategory } from "@/lib/taskCategories";

interface TaskCategoryBadgeProps {
  category: TaskCategory | null;
}

export function TaskCategoryBadge({ category }: TaskCategoryBadgeProps) {
  if (category === null) {
    return (
      <span className="rounded-md border border-surface-border bg-surface-overlay px-2 py-0.5 text-xs text-text-muted">
        Uncategorized
      </span>
    );
  }

  // Same out-of-range fallback as getCategoryColorByName: index 0 when the
  // color index is outside the palette's 0-7 range.
  const category_color =
    CATEGORY_COLOR_PALETTE[category.color] ?? CATEGORY_COLOR_PALETTE[0];

  return (
    <span
      className={`rounded-md border px-2 py-0.5 text-xs ${category_color.badgeBg} ${category_color.badgeBorder} ${category_color.text}`}
    >
      {category.name}
    </span>
  );
}
