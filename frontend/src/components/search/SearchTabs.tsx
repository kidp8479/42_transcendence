// The type filter on /search, rendered as a tab bar - same shape and same two
// class strings as the project tab bar (navigation/ProjectTabs.tsx), so the two
// read as the same control.
//
// One difference that matters: ProjectTabs can lean on TanStack's activeProps,
// which compares PATHNAMES. All four tabs here point at /search and differ only
// by a search param, so activeProps would light up all four (or none). The
// active state is computed by hand below, aria-current included - nothing else
// sets it once activeProps is gone.
import { Link } from "@tanstack/react-router";
import type { IconType } from "react-icons";
import {
  HiOutlineFolder,
  HiOutlineRectangleStack,
  HiOutlineSquares2X2,
  HiOutlineUsers,
} from "react-icons/hi2";
import type { SearchType } from "@/lib/searchApi";
import {
  nextSearchParams,
  type SearchPageParams,
} from "@/lib/searchPageParams";

interface SearchTabsProps {
  params: SearchPageParams;
  counts: { projects: number; tasks: number; users: number };
}

const TAB_CLASS =
  "flex shrink-0 items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap";
const TAB_ACTIVE_CLASS = "border-brand-500 text-brand-500";
const TAB_INACTIVE_CLASS =
  "border-transparent text-text-secondary hover:border-brand-500/40 hover:text-text-primary";

// The counts are the point of the tab bar - they say where the results are
// before you click anything - so they are text-xs on a filled pill rather than
// the 10px muted-grey pastille the Projects page uses for a passing detail.
// The active tab's count carries the brand tint its label already has.
const TAB_COUNT_CLASS = "rounded-full px-2 py-0.5 text-xs font-semibold";
const TAB_COUNT_ACTIVE_CLASS = "bg-brand-500/15 text-brand-500";
const TAB_COUNT_INACTIVE_CLASS = "bg-surface-overlay text-text-secondary";

export function SearchTabs({ params, counts }: SearchTabsProps) {
  const tabs: {
    type: SearchType;
    label: string;
    icon: IconType;
    count: number;
  }[] = [
    {
      type: "all",
      label: "All",
      icon: HiOutlineSquares2X2,
      count: counts.projects + counts.tasks + counts.users,
    },
    {
      type: "projects",
      label: "Projects",
      icon: HiOutlineFolder,
      count: counts.projects,
    },
    {
      type: "tasks",
      label: "Tasks",
      icon: HiOutlineRectangleStack,
      count: counts.tasks,
    },
    {
      type: "users",
      label: "Members",
      icon: HiOutlineUsers,
      count: counts.users,
    },
  ];

  return (
    <nav
      aria-label="Search result types"
      className="scrollbar-thin-surface flex shrink-0 overflow-x-auto border-b border-surface-border"
    >
      {tabs.map((tab) => {
        const isActive = params.type === tab.type;

        return (
          <Link
            key={tab.type}
            to="/search"
            // The status filter is dropped on purpose: its values come from two
            // different enums, and a TODO carried onto the Projects tab would
            // filter nothing while still showing as active. The sort is kept -
            // it means the same thing everywhere. Page is dropped by
            // nextSearchParams itself.
            search={nextSearchParams(params, {
              type: tab.type,
              status: undefined,
            })}
            aria-current={isActive ? "page" : undefined}
            className={
              TAB_CLASS +
              " " +
              (isActive ? TAB_ACTIVE_CLASS : TAB_INACTIVE_CLASS)
            }
          >
            <tab.icon className="h-5 w-5" />
            {tab.label}
            <span
              className={
                TAB_COUNT_CLASS +
                " " +
                (isActive ? TAB_COUNT_ACTIVE_CLASS : TAB_COUNT_INACTIVE_CLASS)
              }
            >
              {tab.count}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
