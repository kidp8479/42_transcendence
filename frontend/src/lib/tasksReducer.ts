// Pure state transitions for the project's task list (Kanban board today,
// List tab later). No React in here on purpose: the route drives it through
// useReducer now, and the future WebSocket handler can dispatch the exact
// same actions when "task created/updated/moved/deleted" events arrive - one
// source of truth for how the task list changes, whatever triggered it.
//
// State is the flat Task[] (the shape GET /tasks will return); columns are
// derived per status with selectColumnTasks. rank is the 0-based position of
// a task inside its STATUS column. Every transition that touches a column
// reindexes it to a dense 0..n-1, so ranks never gap and re-dispatching the
// same action is harmless (the board dispatches task_moved from both dragOver
// and dragEnd).
import type { Task, TaskStatus } from "@/lib/tasks";

export type TasksAction =
  // initial fetch or a future WS resync
  | { type: "tasks_loaded"; tasks: Task[] }
  | { type: "task_created"; task: Task }
  | { type: "task_updated"; taskId: string; changes: Partial<Task> }
  | {
      type: "task_moved";
      taskId: string;
      toStatus: TaskStatus;
      toIndex: number;
    }
  | { type: "task_deleted"; taskId: string };

export function tasksReducer(state: Task[], action: TasksAction): Task[] {
  switch (action.type) {
    case "tasks_loaded":
      return action.tasks;

    case "task_created":
      return reindexStatus([...state, action.task], action.task.status);

    case "task_updated": {
      const existing = state.find((task) => task.id === action.taskId);
      if (!existing) {
        return state;
      }
      const next = state.map((task) =>
        task.id === action.taskId ? { ...task, ...action.changes } : task
      );
      // A status change through update (ex: the drawer's Status select) moves
      // the task between columns too - keep both columns' ranks dense.
      const new_status = action.changes.status;
      if (new_status !== undefined && new_status !== existing.status) {
        return reindexStatus(reindexStatus(next, existing.status), new_status);
      }
      return next;
    }

    case "task_moved": {
      const moved = state.find((task) => task.id === action.taskId);
      if (!moved) {
        return state;
      }
      const from_status = moved.status;

      // Destination column without the moved task, in display order, then the
      // moved task spliced in at the requested index (clamped to valid range).
      const destination = state
        .filter(
          (task) => task.status === action.toStatus && task.id !== moved.id
        )
        .sort(byRank);
      const insert_index = Math.max(
        0,
        Math.min(action.toIndex, destination.length)
      );
      destination.splice(insert_index, 0, moved);

      // Source column also needs reindexing when the task changed columns
      // (same-column moves are fully covered by the destination pass).
      const source =
        from_status === action.toStatus
          ? []
          : state
              .filter(
                (task) => task.status === from_status && task.id !== moved.id
              )
              .sort(byRank);

      const new_positions = new Map<
        string,
        { status: TaskStatus; rank: number }
      >();
      destination.forEach((task, index) => {
        new_positions.set(task.id, { status: action.toStatus, rank: index });
      });
      source.forEach((task, index) => {
        new_positions.set(task.id, { status: from_status, rank: index });
      });

      // Only produce new objects for tasks whose position actually changed -
      // keeps repeated dispatches of the same move referentially stable.
      return state.map((task) => {
        const position = new_positions.get(task.id);
        if (
          !position ||
          (task.status === position.status && task.rank === position.rank)
        ) {
          return task;
        }
        return { ...task, status: position.status, rank: position.rank };
      });
    }

    case "task_deleted": {
      const existing = state.find((task) => task.id === action.taskId);
      if (!existing) {
        return state;
      }
      return reindexStatus(
        state.filter((task) => task.id !== action.taskId),
        existing.status
      );
    }
  }
}

// One column of the board: the tasks of a status, in rank order.
export function selectColumnTasks(tasks: Task[], status: TaskStatus): Task[] {
  return tasks.filter((task) => task.status === status).sort(byRank);
}

// Append position for a task created into a status column.
export function nextRankForStatus(tasks: Task[], status: TaskStatus): number {
  return tasks.filter((task) => task.status === status).length;
}

function byRank(a: Task, b: Task): number {
  return a.rank - b.rank;
}

// Rewrites one status column's ranks to a dense 0..n-1 (display order kept).
function reindexStatus(tasks: Task[], status: TaskStatus): Task[] {
  const column = tasks.filter((task) => task.status === status).sort(byRank);
  const new_ranks = new Map<string, number>();
  column.forEach((task, index) => {
    new_ranks.set(task.id, index);
  });
  return tasks.map((task) => {
    const new_rank = new_ranks.get(task.id);
    if (new_rank === undefined || task.rank === new_rank) {
      return task;
    }
    return { ...task, rank: new_rank };
  });
}
