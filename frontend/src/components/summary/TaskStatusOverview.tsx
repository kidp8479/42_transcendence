import {
  HiOutlineDotsCircleHorizontal,
  HiOutlineRefresh,
  HiOutlineEye,
  HiOutlineCheckCircle,
} from "react-icons/hi";
import type { IconType } from "react-icons";

interface TaskStatusOverviewProps {
  tasksByStatus: {
    TODO: number;
    IN_PROGRESS: number;
    REVIEW: number;
    COMPLETED: number;
  };
}

type TaskStatusKey = keyof TaskStatusOverviewProps["tasksByStatus"];

// Display info for each status: label + color + render order. Kept separate
// from tasksByStatus because the raw data is just bare numbers with no
// presentation info attached.
const TASK_STATUSES: {
  status_name: string;
  status_key: TaskStatusKey;
  color: string;
  icon: IconType;
}[] = [
  {
    status_name: "To Do",
    status_key: "TODO",
    color: "text-status-todo",
    icon: HiOutlineDotsCircleHorizontal,
  },
  {
    status_name: "In Progress",
    status_key: "IN_PROGRESS",
    color: "text-status-in-progress",
    icon: HiOutlineRefresh,
  },
  {
    status_name: "Review",
    status_key: "REVIEW",
    color: "text-status-review",
    icon: HiOutlineEye,
  },
  {
    status_name: "Completed",
    status_key: "COMPLETED",
    color: "text-status-completed",
    icon: HiOutlineCheckCircle,
  },
];

export function TaskStatusOverview({ tasksByStatus }: TaskStatusOverviewProps) {
  return (
    <section aria-labelledby="task-status-heading">
      <h2 id="task-status-heading" className="sr-only">
        Task Status Overview
      </h2>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {TASK_STATUSES.map((current_status) => (
          <div
            key={current_status.status_key}
            className="rounded-lg border border-surface-border bg-surface-raised p-4"
          >
            <p className="flex items-center gap-1.5 text-sm text-text-secondary">
              <current_status.icon className={current_status.color} />
              {current_status.status_name}
            </p>
            <p
              className={`mt-2 mb-1 text-2xl font-bold ${current_status.color}`}
            >
              {tasksByStatus[current_status.status_key]}
            </p>
            <p className="text-xs text-text-secondary">tasks</p>
          </div>
        ))}
      </div>
    </section>
  );
}
