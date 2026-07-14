"use client";

import { useState } from "react";
import {
  Sidebar,
  SidebarItem,
  SidebarItemGroup,
  SidebarItems,
} from "flowbite-react";
import { Link } from "@tanstack/react-router";
import { HiChevronLeft, HiChevronRight, HiMenu, HiX } from "react-icons/hi";
import { MdOutlineDashboard } from "react-icons/md";
import { GoFileDirectory } from "react-icons/go";

// <SidebarItem as={Link} to="/location" ...> is used to load only the "working space" area, rather than the whole page

// If VSCode is unhappy with `to` (red squiggly line), it seems to be because of Flowbite's implementation of Typescript types.
// Other than that, the Javascript is properly compiled at runtime.

interface Project {
  slug: string;
  name: string;
  statusColor: string;
}

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

function ProjectRow({ project }: { project: Project }) {
  return (
    <SidebarItem
      as={Link}
      to={`/projects`}
      theme={{
        base: "flex items-center rounded-lg pl-1 pr-2 py-2",
        content: { base: "flex-1 whitespace-nowrap px-1" },
      }}
    >
      <span className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${project.statusColor}`}
        />
        <span className="truncate">{project.name}</span>{" "}
        <HiChevronRight className="h-4 w-4 text-gray-400" />{" "}
      </span>
    </SidebarItem>
  );
}

export function SideBarCmp() {
  const [isCollapsed, setIsCollapsed] = useState(false);

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
          fixed inset-y-0 left-0 z-40 w-full transition-transform duration-300
          ${isCollapsed ? "-translate-x-full" : "translate-x-0"}
          md:relative md:z-auto md:shrink-0 md:translate-x-0 md:transition-[width]
          ${isCollapsed ? "md:w-0" : "md:w-64"}
        `}
      >
        <div className="font-mono relative h-full w-full overflow-hidden">
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
                inner:
                  "h-full overflow-y-auto overflow-x-hidden rounded px-2.5 py-4 !bg-surface-raised !dark:bg-surface-raised",
              },
              item: {
                base: "flex items-center justify-center rounded-lg p-2 text-base font-normal text-text-secondary hover:bg-surface-overlay hover:text-text-primary",
                active: "bg-brand-500/10 text-brand-500",
                icon: {
                  base: "h-6 w-6 shrink-0 text-text-muted transition duration-75 group-hover:text-text-primary",
                  active: "text-brand-500",
                },
              },
            }}
          >
            <SidebarItems>
              <SidebarItemGroup className="font-mono tracking-tight text-sm lg:text-base">
                <SidebarItem
                  as={Link}
                  to="/dashboard"
                  icon={MdOutlineDashboard}
                >
                  Dashboard
                </SidebarItem>
                <SidebarItem as={Link} to="/projects" icon={GoFileDirectory}>
                  Projects
                </SidebarItem>
              </SidebarItemGroup>
              <SidebarItemGroup>
                <li className="px-3 pb-2 font-mono text-xs tracking-wider text-text-muted uppercase">
                  Current projects
                </li>

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
          className="absolute top-1/2 right-0 hidden h-10 w-4 translate-x-full -translate-y-full items-center justify-center rounded-r-md border border-l-0 border-surface-border bg-surface-raised text-text-muted hover:bg-surface-overlay hover:text-text-primary md:flex"
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
          className="fixed top-4 left-4 z-40 flex h-10 w-10 items-center justify-center rounded-md border border-surface-border bg-surface-raised text-text-muted hover:bg-surface-overlay hover:text-text-primary md:hidden"
        >
          <HiMenu size={18} />
        </button>
      )}
    </>
  );
}
