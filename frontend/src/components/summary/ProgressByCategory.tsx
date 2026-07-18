import { CATEGORY_COLOR_PALETTE } from "@/lib/categoryColorPalette";

export interface CategoryProgress {
  name: string;
  completed: number;
  total: number;
  // index into CATEGORY_COLOR_PALETTE, matches TaskCategory.color (Int) in schema.prisma
  color: number;
}

interface ProgressByCategoryProps {
  categories: CategoryProgress[];
}

export function ProgressByCategory({ categories }: ProgressByCategoryProps) {
  return (
    <section
      aria-labelledby="progress-by-category-heading"
      className="rounded-lg border border-surface-border bg-surface-raised p-4 lg:col-span-2"
    >
      <h2
        id="progress-by-category-heading"
        className="mb-4 font-mono text-base font-semibold text-text-primary"
      >
        Progress by Category
      </h2>
      {categories.map((category) => {
        // total is expected to be filtered server-side to always be > 0
        // (see "13. Summary" Notion page - 0/0 categories should never reach
        // this component) - guard anyway so a missed filter doesn't render
        // NaN into aria-valuenow/width instead of just crashing loudly.
        const percent =
          category.total === 0
            ? 0
            : Math.min(100, (category.completed / category.total) * 100);
        return (
          <div key={category.name} className="mb-3">
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-text-primary">{category.name}</span>
              <span className="text-text-secondary">
                {category.completed}/{category.total}
              </span>
            </div>
            <div
              className="h-2 w-full rounded-full bg-surface-overlay"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${category.name} progress`}
            >
              <div
                className={`h-2 rounded-full ${CATEGORY_COLOR_PALETTE[category.color].bg}`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        );
      })}
    </section>
  );
}
