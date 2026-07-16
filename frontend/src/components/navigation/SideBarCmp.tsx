"use client";

import { useEffect, useState } from "react";
import {
  Sidebar,
  SidebarItemGroup,
  SidebarItems,
} from "flowbite-react";
import { Link } from "@tanstack/react-router";
import { HiChevronLeft, HiChevronRight, HiMenu, HiX } from "react-icons/hi";
import { MdOutlineDashboard } from "react-icons/md";
import { GoFileDirectory } from "react-icons/go";

// <SidebarItem as={Link} to="/location" ...> is used to load only the "working space" area, rather than the whole page

interface Project {
  slug: string;
  name: string;
  statusColor: string;
}

const sidebarContainerClasses =
  "fixed inset-y-0 left-0 z-40 w-full transition-transform duration-300";
const sidebarInnerClasses = "font-mono relative h-full w-full overflow-hidden";
const sidebarSurfaceClasses =
  "h-full overflow-y-auto overflow-x-hidden rounded px-2.5 py-4 !bg-surface-raised !dark:bg-surface-raised";
const sidebarItemClasses =
  "flex items-center justify-center rounded-lg p-2 text-base font-normal text-text-secondary hover:bg-surface-overlay hover:text-text-primary";
const sidebarNavLinkClasses =
  "flex items-center gap-3 rounded-lg p-2 text-base font-normal text-text-secondary hover:bg-surface-overlay hover:text-text-primary";
const sidebarNavLinkActiveClasses = "bg-brand-500/10 text-brand-500";
const sidebarGroupClasses = "font-mono tracking-tight text-sm lg:text-base";
const sidebarSectionLabelClasses =
  "px-3 pb-2 font-mono text-xs tracking-wider text-text-muted uppercase";
const sidebarToggleBaseClasses =
  "absolute top-1/2 right-0 hidden h-10 w-4 translate-x-full -translate-y-full items-center justify-center rounded-r-md border border-l-0 border-surface-border bg-surface-raised text-text-muted hover:bg-surface-overlay hover:text-text-primary md:flex";
const sidebarMobileToggleClasses =
  "fixed top-4 left-4 z-40 flex h-10 w-10 items-center justify-center rounded-md border border-surface-border bg-surface-raised text-text-muted hover:bg-surface-overlay hover:text-text-primary md:hidden";

// Temporary mock data until the projects list is backed by the API.
// The sidebar keeps the row structure stable so we can swap the data source later.
const projects: Project[] = [
  {
    slug: "ft_transcendence",
    name: "ft_transcendence",
    statusColor: "bg-emerald-400",
  },
  {
    slug: "minishell",
    name: "minishell",
    statusColor: "bg-gray-500",
  },
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

function ProjectRow({ project }: { project: Project }) {
  return (
    <Link
      // Each project needs its own route target so only one row can be active at a time.
      to="/$projectId/summary"
      params={{ projectId: project.slug }}
      activeProps={{ className: `${sidebarNavLinkClasses} ${sidebarNavLinkActiveClasses}` }}
      inactiveProps={{ className: sidebarNavLinkClasses }}
    >
      <span className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${project.statusColor}`}
        />
        <span className="truncate">{project.name}</span>{" "}
        <HiChevronRight className="h-4 w-4 text-text-muted" />{" "}
      </span>
    </Link>
  );
}

export function SideBarCmp() {
  const isDesktop = useIsDesktop();
  // Mobile starts collapsed; desktop starts open so the content stays visible.
  const [isCollapsed, setIsCollapsed] = useState(() => !isDesktop);

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
          md:relative md:z-auto md:shrink-0 md:translate-x-0 md:transition-[width]
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
            className="h-full w-full md:w-64"
            theme={{
              root: {
                inner: sidebarSurfaceClasses,
              },
              item: {
                base: sidebarItemClasses,
                active: "bg-brand-500/10 text-brand-500",
                icon: {
                  base: "h-6 w-6 shrink-0 text-text-muted transition duration-75 group-hover:text-text-primary",
                  active: "text-brand-500",
                },
              },
            }}
          >
            <SidebarItems>
              <SidebarItemGroup className={sidebarGroupClasses}>
                <Link
                  to="/dashboard"
                  activeProps={{
                    className: `${sidebarNavLinkClasses} ${sidebarNavLinkActiveClasses}`,
                  }}
                  inactiveProps={{ className: sidebarNavLinkClasses }}
                >
                  <MdOutlineDashboard className="h-6 w-6 shrink-0 text-text-muted transition duration-75 group-hover:text-text-primary" />
                  <span>Dashboard</span>
                </Link>
                <Link
                  to="/projects"
                  activeProps={{
                    className: `${sidebarNavLinkClasses} ${sidebarNavLinkActiveClasses}`,
                  }}
                  inactiveProps={{ className: sidebarNavLinkClasses }}
                >
                  <GoFileDirectory className="h-6 w-6 shrink-0 text-text-muted transition duration-75 group-hover:text-text-primary" />
                  <span>Projects</span>
                </Link>
              </SidebarItemGroup>
              <SidebarItemGroup>
                <li className={sidebarSectionLabelClasses}>Current projects</li>

                {projects.map((project) => (
                  <ProjectRow key={project.slug} project={project} />
                ))}
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
