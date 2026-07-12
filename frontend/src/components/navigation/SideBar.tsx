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
      <div className="h-full overflow-hidden">
        <Sidebar aria-label="Sidebar" className="h-full w-64">
          <SidebarItems>
            <SidebarItemGroup>
              <SidebarItem as={Link} to="/dashboard" icon={MdOutlineDashboard}>
                Dashboard
              </SidebarItem>
              <SidebarItem as={Link} to="/projects" icon={GoFileDirectory}>
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
        className="absolute top-1/2 right-0 flex h-10 w-4 translate-x-full -translate-y-full items-center justify-center rounded-r-md border border-l-0 border-gray-700 bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
      >
        {isCollapsed ? (
          <HiChevronRight size={14} />
        ) : (
          <HiChevronLeft size={14} />
        )}
      </button>
    </div>
  );
}
