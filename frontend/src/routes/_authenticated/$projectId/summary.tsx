import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/$projectId/summary")({
  component: SummaryPage,
});

function SummaryPage() {
  const summary_json_mock_up = {
    tasks_by_status: {
      TODO: 10,
      IN_PROGRESS: 5,
      REVIEW: 2,
      COMPLETED: 8,
    },
    // color: index into CATEGORY_COLOR_PALETTE, matches TaskCategory.color (Int) in schema.prisma
    categories: [
      { name: "Planning", completed: 1, total: 1, color: 0 },
      { name: "Development", completed: 5, total: 12, color: 1 },
      { name: "Testing", completed: 0, total: 1, color: 2 },
      { name: "Backend", completed: 1, total: 5, color: 3 },
      { name: "Frontend", completed: 1, total: 3, color: 4 },
      { name: "DevOps", completed: 2, total: 2, color: 5 },
      { name: "Parsing", completed: 0, total: 2, color: 6 },
      { name: "Documentation", completed: 1, total: 2, color: 7 },
    ],
  };

  // Shared palette every category picks from (via its color index) - bounded set,
  // works no matter how many categories a project ends up creating.
  const CATEGORY_COLOR_PALETTE = [
    "bg-category-0",
    "bg-brand-500", // index 1 reuses the brand color directly, no separate token needed
    "bg-category-2",
    "bg-category-3",
    "bg-category-4",
    "bg-category-5",
    "bg-category-6",
    "bg-category-7",
  ];

  type TaskStatusKey = keyof typeof summary_json_mock_up.tasks_by_status;

  const task_statuses: {
    status_name: string;
    status_key: TaskStatusKey;
    color: string;
  }[] = [
    { status_name: "To Do", status_key: "TODO", color: "text-status-todo" },
    {
      status_name: "In Progress",
      status_key: "IN_PROGRESS",
      color: "text-status-in-progress",
    },
    {
      status_name: "Review",
      status_key: "REVIEW",
      color: "text-status-review",
    },
    {
      status_name: "Completed",
      status_key: "COMPLETED",
      color: "text-status-completed",
    },
  ];

  return (
    <>
      <div className="grid grid-cols-4 gap-4">
        {task_statuses.map((current_status) => (
          <div
            key={current_status.status_key}
            className="rounded-lg border border-surface-border bg-surface-raised p-4"
          >
            <p className="text-sm text-text-secondary">
              {current_status.status_name}
            </p>
            <p className={`text-2xl font-bold ${current_status.color}`}>
              {summary_json_mock_up.tasks_by_status[current_status.status_key]}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-lg border border-surface-border bg-surface-raised p-4">
        <h2 className="mb-4 text-lg font-bold text-text-primary">
          Progress by Category
        </h2>
        {summary_json_mock_up.categories.map((category) => {
          const percent = (category.completed / category.total) * 100;
          return (
            <div key={category.name} className="mb-3">
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-text-primary">{category.name}</span>
                <span className="text-text-secondary">
                  {category.completed}/{category.total}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-surface-overlay">
                <div
                  className={`h-2 rounded-full ${CATEGORY_COLOR_PALETTE[category.color]}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
