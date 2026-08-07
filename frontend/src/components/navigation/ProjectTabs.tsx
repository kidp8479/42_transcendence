import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import {
  HiOutlineChartBar,
  HiOutlineLightBulb,
  HiOutlineViewBoards,
  HiOutlineCalendar,
  HiOutlineClipboardCheck,
  HiOutlineCog,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
} from "react-icons/hi";

// How far one arrow click scrolls the bar - roughly 3 tabs' worth, not a
// single tab at a time (that would take too many clicks to get anywhere).
const SCROLL_STEP_PX = 240;

export function ProjectTabs() {
  const { projectId } = useParams({ from: "/_authenticated/$projectId" });
  const navRef = useRef<HTMLElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // With enough tabs, the bar scrolls horizontally but gives no hint there's
  // more off-screen - only the thin scrollbar itself, easy to miss. Tracks
  // real scroll position/overflow (not just "does it overflow at all") so
  // each arrow only shows on the side there's actually more to scroll to.
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;

    function updateArrows() {
      if (!el) return;
      setCanScrollLeft(el.scrollLeft > 0);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    }

    updateArrows();
    el.addEventListener("scroll", updateArrows);
    const resizeObserver = new ResizeObserver(updateArrows);
    resizeObserver.observe(el);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      resizeObserver.disconnect();
    };
  }, []);

  function scrollBy(deltaPx: number) {
    navRef.current?.scrollBy({ left: deltaPx, behavior: "smooth" });
  }

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
    // relative: anchors the two absolutely-positioned arrow buttons below to
    // this bar specifically, not some further-out ancestor.
    <div className="relative">
      <nav
        ref={navRef}
        aria-label="Project tabs"
        // shrink-0 is not optional here: overflow-x-auto makes min-height
        // resolve to 0 (no content-based floor), so in the bounded column
        // this bar could be crushed to nothing.
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
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollBy(-SCROLL_STEP_PX)}
          aria-label="Scroll tabs left"
          className="absolute inset-y-0 left-0 flex w-8 items-center justify-center bg-gradient-to-r from-surface-base via-surface-base text-text-secondary hover:text-text-primary"
        >
          <HiOutlineChevronLeft className="h-5 w-5" />
        </button>
      )}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => scrollBy(SCROLL_STEP_PX)}
          aria-label="Scroll tabs right"
          className="absolute inset-y-0 right-0 flex w-8 items-center justify-center bg-gradient-to-l from-surface-base via-surface-base text-text-secondary hover:text-text-primary"
        >
          <HiOutlineChevronRight className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
