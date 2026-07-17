import type { IconType } from "react-icons";
import { useEffect, useState } from "react";
import { Sidebar, SidebarItemGroup, SidebarItems } from "flowbite-react";
import { Link, useLoaderData } from "@tanstack/react-router";
import { HiChevronLeft, HiChevronRight, HiMenu, HiX } from "react-icons/hi";
import { MdOutlineDashboard } from "react-icons/md";
import { GoFileDirectory } from "react-icons/go";
import type { SidebarProject } from "@/lib/projects";

// <SidebarItem as={Link} to="/location" ...> is used to load only the "working space" area, rather than the whole page

interface NavigationItem {
  to: string;
  label: string;
  icon: IconType;
}

const sidebarContainerClasses =
  "fixed inset-y-0 left-0 z-40 w-full transition-transform duration-300";
const sidebarInnerClasses = "font-mono relative h-full w-full overflow-hidden";
// Fixed: dark: variant must come right before the utility, `!` goes after the variant.
const sidebarSurfaceClasses =
  "h-full overflow-y-auto overflow-x-hidden rounded px-2.5 py-4 !bg-surface-raised dark:!bg-surface-raised";
const sidebarIconClasses =
  "h-6 w-6 shrink-0 text-text-muted transition duration-75 group-hover:text-text-primary";
const sidebarNavLinkClasses =
  "flex items-center gap-3 rounded-lg p-2 text-base font-normal text-text-secondary hover:bg-surface-overlay hover:text-text-primary";
const sidebarNavLinkActiveClasses = "bg-brand-500/10 text-brand-500";
const activeSidebarLinkClasses = `${sidebarNavLinkClasses} ${sidebarNavLinkActiveClasses}`;
const sidebarGroupClasses = "font-mono tracking-tight text-sm lg:text-base";
const sidebarSectionLabelClasses =
  "px-3 pb-2 font-mono text-xs tracking-wider text-text-muted uppercase";
const sidebarToggleBaseClasses =
  "absolute top-1/2 right-0 hidden h-10 w-4 translate-x-full -translate-y-1/2 items-center justify-center rounded-r-md border border-l-0 border-surface-border bg-surface-raised text-text-muted hover:bg-surface-overlay hover:text-text-primary md:flex";
const sidebarMobileToggleClasses =
  "fixed top-0 left-4 z-40 flex h-10 w-10 items-center justify-center rounded-md border border-surface-border bg-surface-raised text-text-muted hover:bg-surface-overlay hover:text-text-primary md:hidden";

// Only `root.inner` is used since nav rows are custom <Link> elements, not
// Flowbite's <SidebarItem>. Removed the unused `item` theme block that was
// dead code (active/icon styling never reached the DOM through this theme).
const sidebarTheme = {
  root: {
    inner: sidebarSurfaceClasses,
  },
} as const;

const sidebarPrimaryNavigation: NavigationItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: MdOutlineDashboard },
  { to: "/projects", label: "Projects", icon: GoFileDirectory },
];

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(min-width: 768px)").matches
      : true
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");

    const update = () => setIsDesktop(mediaQuery.matches);
    update();

    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return isDesktop;
}

function SidebarNavLink({ to, label, icon: Icon }: NavigationItem) {
  return (
    <li>
      <Link
        to={to}
        activeProps={{ className: activeSidebarLinkClasses }}
        inactiveProps={{ className: sidebarNavLinkClasses }}
      >
        <Icon className={sidebarIconClasses} />
        <span>{label}</span>
      </Link>
    </li>
  );
}

function SidebarSectionTitle({ children }: { children: string }) {
  return <li className={sidebarSectionLabelClasses}>{children}</li>;
}

function ProjectRow({ project }: { project: SidebarProject }) {
  // Keep the visual indicator simple and deterministic from backend status.
  const statusColorClass =
    project.status === "COMPLETED"
      ? "bg-status-completed"
      : project.status === "REVIEW"
        ? "bg-status-review"
        : "bg-status-in-progress";

  return (
    <Link
      // Each project needs its own route target so only one row can be active at a time.
      to="/$projectId/summary"
      params={{ projectId: project.id }}
      activeProps={{ className: activeSidebarLinkClasses }}
      inactiveProps={{ className: sidebarNavLinkClasses }}
    >
      <span className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        <span className={`h-2 w-2 shrink-0 rounded-full ${statusColorClass}`} />
        <span className="truncate">{project.name}</span>
        <HiChevronRight className="h-4 w-4 text-text-muted" />
      </span>
    </Link>
  );
}

export function SideBarCmp() {
  // Data comes from /_authenticated route loader (GET /api/projects).
  // This keeps sidebar data fetching at layout level instead of per page.
  const projects = useLoaderData({ from: "/_authenticated" });
  const visibleProjects = projects.filter(
    (project) => project.status !== "COMPLETED"
  );
  const isDesktop = useIsDesktop();
  // Mobile starts collapsed; desktop starts open so the content stays visible.
  const [isCollapsed, setIsCollapsed] = useState(() => !isDesktop);

  // Resync when crossing the desktop/mobile breakpoint after mount (resize,
  // rotation). Without this, resizing from desktop-open to mobile instantly
  // shows the full-screen backdrop, and resizing back to desktop can leave
  // the sidebar collapsed with no visible way to reopen it except the toggle.
  useEffect(() => {
    setIsCollapsed(!isDesktop);
  }, [isDesktop]);

  // Close on Escape for basic keyboard accessibility on mobile.
  useEffect(() => {
    if (isCollapsed) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsCollapsed(true);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCollapsed]);

  return (
    <>
      {/* Backdrop: only shown on mobile when the sidebar is open, click to close */}
      {!isCollapsed && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setIsCollapsed(true)}
          aria-hidden="true"
        />
      )}

      <div
        className={`
          ${sidebarContainerClasses}
          ${isCollapsed ? "-translate-x-full" : "translate-x-0"}
          md:sticky md:top-0 md:h-screen md:z-auto md:self-start md:shrink-0 md:translate-x-0 md:transition-[width]
          ${isCollapsed ? "md:w-0" : "md:w-64"}
        `}
      >
        <div className={sidebarInnerClasses}>
          <button
            type="button"
            onClick={() => setIsCollapsed(true)}
            aria-label="Close sidebar"
            className="absolute top-4 right-4 z-10 flex h-9 w-9 items-center justify-center rounded-md text-text-muted hover:bg-surface-overlay hover:text-text-primary md:hidden"
          >
            <HiX size={18} />
          </button>

          <Sidebar
            aria-label="Sidebar"
            className="h-full w-full"
            theme={sidebarTheme}
          >
            <SidebarItems>
              <SidebarItemGroup className={sidebarGroupClasses}>
                {sidebarPrimaryNavigation.map((item) => (
                  <SidebarNavLink key={item.to} {...item} />
                ))}
              </SidebarItemGroup>
              <SidebarItemGroup>
                <SidebarSectionTitle>Current projects</SidebarSectionTitle>

                {visibleProjects.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-text-muted">
                    No projects yet
                  </li>
                ) : (
                  visibleProjects.map((project) => (
                    <ProjectRow key={project.id} project={project} />
                  ))
                )}
              </SidebarItemGroup>
            </SidebarItems>
          </Sidebar>
        </div>

        {/* Desktop collapse/expand toggle: squeezes the panel width, hidden on mobile */}
        <button
          type="button"
          onClick={() => setIsCollapsed((prev) => !prev)}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={sidebarToggleBaseClasses}
        >
          {isCollapsed ? (
            <HiChevronRight size={14} />
          ) : (
            <HiChevronLeft size={14} />
          )}
        </button>
      </div>

      {/* Mobile open button: only rendered while the off-canvas sidebar is closed */}
      {isCollapsed && (
        <button
          type="button"
          onClick={() => setIsCollapsed(false)}
          aria-label="Expand sidebar"
          className={sidebarMobileToggleClasses}
        >
          <HiMenu size={18} />
        </button>
      )}
    </>
  );
}
