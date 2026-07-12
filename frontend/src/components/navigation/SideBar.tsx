"use client";

import { useState } from "react";
import {
  Sidebar,
  SidebarItem,
  SidebarItemGroup,
  SidebarItems,
} from "flowbite-react";
import { Link } from "@tanstack/react-router";
import { HiChevronLeft, HiChevronRight } from "react-icons/hi";
import { MdOutlineDashboard } from "react-icons/md";
import { GoFileDirectory } from "react-icons/go";

// <SidebarItem as={Link} to="/location" ...> is used to load only the "working space" area, rather than the whole page

// If VSCode is unhappy with `to` (red squiggly line), it seems to be because of Flowbite's implementation of Typescript types.
// Other than that, the Javascript is properly compiled at runtime.

export function SideBar() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div
      className={`relative shrink-0 transition-all duration-300 ${
        isCollapsed ? "w-0" : "w-64"
      }`}
    >
      <div className="font-mono h-full overflow-hidden">
        <Sidebar
          aria-label="Sidebar"
          className="h-full w-64"
          theme={{
            root: {
              inner: "h-full overflow-y-auto overflow-x-hidden rounded bg-surface-base px-3 py-4",
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
            <SidebarItemGroup>
              <SidebarItem className="font-mono text-brand-500 tracking-tight text-sm lg:text-base" as={Link} to="/dashboard" icon={MdOutlineDashboard}>
                Dashboard
              </SidebarItem>
              <SidebarItem className="font-mono text-brand-500 tracking-tight text-sm lg:text-base" as={Link} to="/projects" icon={GoFileDirectory}>
                Projects
              </SidebarItem>
            </SidebarItemGroup>
          </SidebarItems>
        </Sidebar>
      </div>

      <button
        type="button"
        onClick={() => setIsCollapsed((prev) => !prev)}
        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute top-1/2 right-0 flex h-10 w-4 translate-x-full -translate-y-full items-center justify-center rounded-r-md border border-l-0 border-surface-border bg-surface-raised text-text-muted hover:bg-surface-overlay hover:text-text-primary"
      >
        {isCollapsed ? <HiChevronRight size={14} /> : <HiChevronLeft size={14} />}
      </button>
    </div>
  );
}
