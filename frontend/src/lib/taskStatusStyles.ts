// Display metadata for each task status: label, icon, and the layered Kanban
// color classes. Kept in lib/ (not next to a component) because both the board
// and the drawer consume it, and the List tab will too. Labels + icons match
// components/summary/TaskStatusOverview.tsx so status reads the same across
// tabs.
//
// Every EDGE on the board is neutral (border-surface-border, written as a
// literal in the components): column outline, card border, rule under the
// header. The status colour lives on the glyphs instead - the header icon and
// the count pill - plus the "Add task" button, which wears it outright. The
// column title stays neutral on purpose, so the header does not turn into a
// single block of colour.
//
// Cards are the exception that owes nothing to this file: on hover a card takes
// its CATEGORY's colour, not its status - see CATEGORY_COLOR_PALETTE.
//
// Every class is written out in full, opacity variants included - Tailwind only
// compiles classes it can see whole in the source (see categoryColorPalette.ts).
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
  // colour of the column header's icon
  headerIcon: string;
  // Hover colour of the header's "+" button. Its own key rather than a `hover:`
  // built from headerIcon: Tailwind only compiles classes written out in full.
  headerAddHover: string;
  // Tinted pill, two consumers: the column header's task count and the drawer's
  // Status select.
  statusPill: string;
  // The "Add task" button's whole look - outline, fill and text - which it
  // wears at rest, not just on hover, plus the deeper fill it takes on hover.
  addTask: string;
}

export const STATUS_STYLES: Record<TaskStatus, TaskStatusStyle> = {
  TODO: {
    label: "To Do",
    icon: HiOutlineDotsCircleHorizontal,
    headerIcon: "text-status-todo",
    headerAddHover: "hover:text-status-todo",
    statusPill: "border-status-todo/30 bg-status-todo/15 text-status-todo",
    addTask:
      "border-status-todo/50 bg-status-todo/15 text-status-todo hover:bg-status-todo/25",
  },
  IN_PROGRESS: {
    label: "In Progress",
    icon: HiOutlineRefresh,
    headerIcon: "text-status-in-progress",
    headerAddHover: "hover:text-status-in-progress",
    statusPill:
      "border-status-in-progress/30 bg-status-in-progress/15 text-status-in-progress",
    addTask:
      "border-status-in-progress/50 bg-status-in-progress/15 text-status-in-progress hover:bg-status-in-progress/25",
  },
  REVIEW: {
    label: "Review",
    icon: HiOutlineEye,
    headerIcon: "text-status-review",
    headerAddHover: "hover:text-status-review",
    statusPill:
      "border-status-review/30 bg-status-review/15 text-status-review",
    addTask:
      "border-status-review/50 bg-status-review/15 text-status-review hover:bg-status-review/25",
  },
  COMPLETED: {
    label: "Completed",
    icon: HiOutlineCheckCircle,
    headerIcon: "text-status-completed",
    headerAddHover: "hover:text-status-completed",
    statusPill:
      "border-status-completed/30 bg-status-completed/15 text-status-completed",
    addTask:
      "border-status-completed/50 bg-status-completed/15 text-status-completed hover:bg-status-completed/25",
  },
};
