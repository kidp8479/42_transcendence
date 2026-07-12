"use client";

import {
  Sidebar,
  SidebarItem,
  SidebarItemGroup,
  SidebarItems,
} from "flowbite-react";
import { BiBuoy } from "react-icons/bi";
import { Link } from "@tanstack/react-router";
import { MdOutlineDashboard } from "react-icons/md";
// import { GoFileDirectory } from "react-icons/go";
// import { HiArrowSmRight, HiChartPie, HiInbox, HiShoppingBag, HiTable, HiUser, HiViewBoards } from "react-icons/hi";

// <SidebarItem as={Link} to="/location" ...> is used to load only the "workinng space" area, rather than the whole page

// If VSCode is unhappy with `to` (red squiggly line), it seems to be because of Flowbite's implementation of Typescript types.
// Other than that, the Javascript is properly compiled at runtime.

export function SideBar() {
  return (
    <Sidebar>
      <SidebarItems>
        <SidebarItemGroup>
          <SidebarItem as={Link} to="/dashboard" icon={MdOutlineDashboard}>
            Dashboard
          </SidebarItem>
          <SidebarItem as={Link} to="/projects" icon={MdOutlineDashboard}>
            Projects
          </SidebarItem>
        </SidebarItemGroup>
        {/* <SidebarItemGroup>
          <SidebarItem href="#" icon={HiChartPie}>
            Upgrade to Pro
          </SidebarItem>
          <SidebarItem href="#" icon={HiViewBoards}>
            Documentation
          </SidebarItem>
          <SidebarItem href="#" icon={BiBuoy}>
            Help
          </SidebarItem>
        </SidebarItemGroup> */}
      </SidebarItems>
    </Sidebar>
  );
}
