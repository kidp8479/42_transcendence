import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/$projectId/summary")({
  component: SummaryPage,
});

function SummaryPage() {
  const summary_json_mock_up = {
    tasks_by_status: {
      TODO: 6,
      IN_PROGRESS: 5,
      REVIEW: 2,
      COMPLETED: 8,
    },
  };

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
  );
}
