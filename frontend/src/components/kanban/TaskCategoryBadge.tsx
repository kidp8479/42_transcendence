// See DefenseReadiness.tsx (components/summary) for an explanation of the
// pattern every component here follows: interface, props destructuring, pure
// prop-driven rendering.
//
// Category pill shown on kanban cards and in the drawer header - same badge
// recipe as Team Workload's category tags, colored by the category's palette
// index. Task.categoryId is nullable in the schema, so a null category is a
// real case and renders a muted "Uncategorized" pill.
import { getCategoryColor } from "@/lib/categoryColorPalette";
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

  const category_color = getCategoryColor(category.color);

  return (
    // A category name can run to 50 characters (maxTaskCategoryNameLength), so
    // it gets the same treatment as the card title next to it: clipped with an
    // ellipsis, full text on hover. min-w-0 is what lets it shrink at all - a
    // flex item won't go below its content width without it, and truncate would
    // have nothing to clip against.
    <span
      title={category.name}
      className={`min-w-0 truncate rounded-md px-2 py-0.5 text-[10px] ${category_color.badgeBg} ${category_color.text}`}
    >
      {category.name}
    </span>
  );
}
