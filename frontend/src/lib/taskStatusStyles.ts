// Display metadata for each task status: label, icon, and the layered Kanban
// color classes. Kept in lib/ (not next to a component) because both the board
// and the drawer consume it, and the List tab will too. Labels + icons match
// components/summary/TaskStatusOverview.tsx so status reads the same across
// tabs.
//
// The board colors statuses in three layers, from the outside in:
// 1. the board itself is a neutral raised container (see KanbanBoard),
// 2. each column is outlined + tinted with its status color (columnContainer),
// 3. each card carries a further diluted tint of the same color (card) that
//    stacks over the column tint - deliberate "same hue, fading inward" look.
//
// Every class below is written out in full, character for character, even the
// "/5" and "/40" opacity variants. Tailwind only generates CSS for a class it
// can see written whole in the source - a class rebuilt at runtime by joining
// strings (ex: someClass + "/15") never appears in full in the source, so
// Tailwind silently skips it and the class ends up doing nothing.
import type { IconType } from "react-icons";
import {
  HiOutlineCheckCircle,
  HiOutlineDotsCircleHorizontal,
  HiOutlineEye,
  HiOutlineRefresh,
} from "react-icons/hi";
import type { TaskStatus } from "@/lib/tasks";

// Column render order on the board.
export const STATUS_ORDER: TaskStatus[] = [
  "TODO",
  "IN_PROGRESS",
  "REVIEW",
  "COMPLETED",
];

interface TaskStatusStyle {
  label: string;
  icon: IconType;
  // icon + column title color
  headerText: string;
  // tinted column shell (border + faint bg)
  columnContainer: string;
  // count pill next to the column title
  countBadge: string;
  // card border + diluted bg tint
  card: string;
  cardHover: string;
}

export const STATUS_STYLES: Record<TaskStatus, TaskStatusStyle> = {
  TODO: {
    label: "To Do",
    icon: HiOutlineDotsCircleHorizontal,
    headerText: "text-status-todo",
    columnContainer: "border-status-todo/40 bg-status-todo/5",
    countBadge: "border-status-todo/30 bg-status-todo/15 text-status-todo",
    card: "border-status-todo/25 bg-status-todo/10",
    cardHover: "hover:border-status-todo/50",
  },
  IN_PROGRESS: {
    label: "In Progress",
    icon: HiOutlineRefresh,
    headerText: "text-status-in-progress",
    columnContainer: "border-status-in-progress/40 bg-status-in-progress/5",
    countBadge:
      "border-status-in-progress/30 bg-status-in-progress/15 text-status-in-progress",
    card: "border-status-in-progress/25 bg-status-in-progress/10",
    cardHover: "hover:border-status-in-progress/50",
  },
  REVIEW: {
    label: "Review",
    icon: HiOutlineEye,
    headerText: "text-status-review",
    columnContainer: "border-status-review/40 bg-status-review/5",
    countBadge:
      "border-status-review/30 bg-status-review/15 text-status-review",
    card: "border-status-review/25 bg-status-review/10",
    cardHover: "hover:border-status-review/50",
  },
  COMPLETED: {
    label: "Completed",
    icon: HiOutlineCheckCircle,
    headerText: "text-status-completed",
    columnContainer: "border-status-completed/40 bg-status-completed/5",
    countBadge:
      "border-status-completed/30 bg-status-completed/15 text-status-completed",
    card: "border-status-completed/25 bg-status-completed/10",
    cardHover: "hover:border-status-completed/50",
  },
};
