import { Link, useParams } from "@tanstack/react-router";
import {
  HiOutlineChartBar,
  HiOutlineLightBulb,
  HiOutlineViewBoards,
  HiOutlineViewList,
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
    { tabs_name: "List", to: "/$projectId/list", icon: HiOutlineViewList },
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
      className="scrollbar-thin-surface flex overflow-x-auto border-b border-surface-border"
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
