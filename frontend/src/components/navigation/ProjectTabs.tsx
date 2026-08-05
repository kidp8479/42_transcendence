import { Link, useParams } from "@tanstack/react-router";
import {
  HiOutlineChartBar,
  HiOutlineLightBulb,
  HiOutlineViewBoards,
  HiOutlineCalendar,
  HiOutlineClipboardCheck,
  HiOutlineCog,
} from "react-icons/hi";

export function ProjectTabs() {
  const { projectId } = useParams({ from: "/_authenticated/$projectId" });

  const tabs_links = [
    {
      tabs_name: "Summary",
      to: "/$projectId/summary",
      icon: HiOutlineChartBar,
    },
    {
      tabs_name: "Discovery",
      to: "/$projectId/discovery",
      icon: HiOutlineLightBulb,
    },
    {
      tabs_name: "Kanban",
      to: "/$projectId/kanban",
      icon: HiOutlineViewBoards,
    },
    // "List" tab intentionally hidden, not deleted - out of scope for v0 but
    // the route/component (routes/.../list.tsx) stay in place in case v1
    // brings it back, no reason to rip out working code for that.
    {
      tabs_name: "Calendar",
      to: "/$projectId/calendar",
      icon: HiOutlineCalendar,
    },
    {
      tabs_name: "Evaluation Checklist",
      to: "/$projectId/evaluation-checklist",
      icon: HiOutlineClipboardCheck,
    },
    {
      tabs_name: "Project Settings",
      to: "/$projectId/project-settings",
      icon: HiOutlineCog,
    },
  ];

  return (
    <nav
      aria-label="Project tabs"
      // shrink-0 is not optional here: overflow-x-auto makes min-height resolve
      // to 0 (no content-based floor), so in the bounded column this bar could
      // be crushed to nothing.
      className="scrollbar-thin-surface flex shrink-0 overflow-x-auto border-b border-surface-border"
    >
      {tabs_links.map((created_link) => (
        <Link
          key={created_link.to}
          to={created_link.to}
          params={{ projectId }}
          className="flex shrink-0 items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap"
          activeProps={{ className: "border-brand-500 text-brand-500" }}
          inactiveProps={{
            className:
              "border-transparent text-text-secondary hover:text-text-primary",
          }}
        >
          <created_link.icon className="h-5 w-5" />
          {created_link.tabs_name}
        </Link>
      ))}
    </nav>
  );
}
