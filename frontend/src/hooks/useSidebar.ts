import { useContext } from "react";
import { SidebarContext } from "../components/navigation/SidebarProvider";

/**
 * Accesses the shared authenticated-sidebar state (open/collapsed, desktop
 * vs mobile). Shared because the header's mobile toggle button and the
 * sidebar panel itself are rendered by different, unrelated parents.
 */
export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used inside SidebarProvider");
  }
  return context;
}
