import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

interface SidebarContextValue {
  isCollapsed: boolean;
  isDesktop: boolean;
  toggleSidebar: () => void;
  closeSidebar: () => void;
}

export const SidebarContext = createContext<SidebarContextValue | null>(null);

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

/**
 * Owns the authenticated sidebar's open/collapsed state so both the header
 * (mobile toggle button) and SideBarCmp (the panel itself) can share it -
 * they're siblings rendered from different parents (__root.tsx vs
 * AuthenticatedLayout), not parent/child, so plain props can't connect them.
 */
export function SidebarProvider({ children }: PropsWithChildren) {
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

  const toggleSidebar = useCallback(() => setIsCollapsed((prev) => !prev), []);
  const closeSidebar = useCallback(() => setIsCollapsed(true), []);

  const value = useMemo(
    () => ({ isCollapsed, isDesktop, toggleSidebar, closeSidebar }),
    [isCollapsed, isDesktop, toggleSidebar, closeSidebar]
  );

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  );
}
