import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/$projectId/summary")({
  component: SummaryPage,
});

function SummaryPage() {
  // Fake data standing in for the real GET /api/projects/:id/summary response
  // (blocked on auth for now). One object, one field per Summary section
  // (tasks_by_status, categories, and more to come) - each field is that
  // section's own mock block, matching what the backend will eventually send.
  const summary_data_json_mock_up = {
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
    // mock up of upcoming events
    upcoming_events: [],
    // defense_readiness: { ... }, TODO
    // team_workload: [ ... ], TODO
  };

  // Shared palette every category picks from (via its color index).
  // Bounded to 8 entries (0-7) - matches today's 8 default categories. A project
  // with more than 8 categories has no defined color past index 7 yet: no
  // wrap-around/modulo exists, and category creation (backend) doesn't cap
  // the count either. Not fixed for now (edge case, unlikely with the current
  // default list) - revisit if it becomes a real problem.
  const CATEGORY_COLOR_PALETTE = [
    "bg-category-0",
    "bg-category-1",
    "bg-category-2",
    "bg-category-3",
    "bg-category-4",
    "bg-category-5",
    "bg-category-6",
    "bg-category-7",
  ];

  // Locks status_key below to the real keys of tasks_by_status ("TODO" | "IN_PROGRESS" | ...),
  // so a typo or a renamed status gets caught at compile time instead of silently rendering undefined.
  type TaskStatusKey = keyof typeof summary_data_json_mock_up.tasks_by_status;

  // Display info for each status: label + color + render order.
  // Kept separate from summary_data_json_mock_up because the raw data is just bare
  // numbers with no presentation info attached (unlike categories, see above).
  //
  // task_statuses itself is an array (the trailing [] below, right before "=").
  // Each element must be an object shaped exactly like { status_name, status_key, color }
  // - TypeScript checks that shape (and that status_key is a real TaskStatusKey) at compile time.
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
              {
                summary_data_json_mock_up.tasks_by_status[
                  current_status.status_key
                ]
              }
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-lg border border-surface-border bg-surface-raised p-4">
        <h2 className="mb-4 text-lg font-bold text-text-primary">
          Progress by Category
        </h2>
        {summary_data_json_mock_up.categories.map((category) => {
          // "=> {" here (vs "=> (" for task_statuses above) starts a real function
          // body, so we can add a line like this before the JSX. That means no
          // more auto-return - the explicit "return" below is required.
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
