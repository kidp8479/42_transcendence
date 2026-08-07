// Display metadata for each project status: label + the color classes a card,
// a badge or a result row wears. Lifted out of components/projects/ProjectCard
// (where it was a module-private STATUS_META) when the search results page
// needed the same labels and colors - the same reason taskStatusStyles.ts sits
// in lib/ rather than next to the board.
//
// Uses the --color-status-* tokens in index.css, the ones the task statuses
// share: a project in REVIEW and a task in REVIEW read as the same state on
// purpose.
//
// Every class below is written out in full, opacity variants included -
// Tailwind only generates CSS for classes it can see whole in the source, see
// the comment in lib/categoryColorPalette.ts.
import type { ProjectStatus } from "@/lib/projectsApi";

// Render order for anything listing every status (the search page's status
// filter today). Matches the project lifecycle, not the enum's declaration.
export const PROJECT_STATUS_ORDER: ProjectStatus[] = [
  "IN_PROGRESS",
  "REVIEW",
  "COMPLETED",
];

interface ProjectStatusStyle {
  label: string;
  // small colored dot (h-2 w-2 rounded-full pattern, see SideBarCmp)
  dot: string;
  text: string;
  badgeBg: string;
  badgeBorder: string;
  // card outline on hover - the one place a project card takes its status color
  hoverBorder: string;
  // Tinted pill, border included, so a project badge and a task badge can be
  // rendered by the same component from one class string. Deliberately mirrors
  // STATUS_STYLES[...].statusPill in taskStatusStyles.ts.
  statusPill: string;
}

export const PROJECT_STATUS_STYLES: Record<ProjectStatus, ProjectStatusStyle> =
  {
    IN_PROGRESS: {
      label: "In Progress",
      dot: "bg-status-in-progress",
      text: "text-status-in-progress",
      badgeBg: "bg-status-in-progress/15",
      badgeBorder: "border-status-in-progress/30",
      hoverBorder: "hover:border-status-in-progress/50",
      statusPill:
        "border-status-in-progress/30 bg-status-in-progress/15 text-status-in-progress",
    },
    REVIEW: {
      label: "Review",
      dot: "bg-status-review",
      text: "text-status-review",
      badgeBg: "bg-status-review/15",
      badgeBorder: "border-status-review/30",
      hoverBorder: "hover:border-status-review/50",
      statusPill:
        "border-status-review/30 bg-status-review/15 text-status-review",
    },
    COMPLETED: {
      label: "Completed",
      dot: "bg-status-completed",
      text: "text-status-completed",
      badgeBg: "bg-status-completed/15",
      badgeBorder: "border-status-completed/30",
      hoverBorder: "hover:border-status-completed/50",
      statusPill:
        "border-status-completed/30 bg-status-completed/15 text-status-completed",
    },
  };
