import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
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

// Only the desktop collapsed/expanded choice is a real preference worth
// remembering - mobile's collapsed state is an overlay visibility flag, not
// a preference, so it's not read from or written to storage.
const sidebarCollapsedStorageKey = "sidebar-collapsed";

function readInitialCollapsed(isDesktop: boolean): boolean {
  if (!isDesktop) return true;
  const stored = window.localStorage.getItem(sidebarCollapsedStorageKey);
  return stored === null ? false : stored === "true";
}

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
  // Mobile starts collapsed; desktop starts open, or restores the user's
  // last choice from localStorage if there is one.
  const [isCollapsed, setIsCollapsed] = useState(() =>
    readInitialCollapsed(isDesktop)
  );

  // Resync when crossing the desktop/mobile breakpoint after mount (resize,
  // rotation). Without this, resizing from desktop-open to mobile instantly
  // shows the full-screen backdrop, and resizing back to desktop can leave
  // the sidebar collapsed with no visible way to reopen it except the toggle.
  // Compares against the last-seen isDesktop rather than a simple "have I
  // run before" flag - React.StrictMode's dev-mode double-invoke replays
  // this effect a second time on mount, and a plain flag would already be
  // flipped by the first pass, letting the second pass fire and overwrite a
  // value just restored from localStorage.
  const previousIsDesktopRef = useRef(isDesktop);
  useEffect(() => {
    if (previousIsDesktopRef.current === isDesktop) return;
    previousIsDesktopRef.current = isDesktop;
    setIsCollapsed(!isDesktop);
  }, [isDesktop]);

  // Persist only the desktop preference - mobile's collapsed state always
  // starts true regardless of what was last stored (see readInitialCollapsed).
  useEffect(() => {
    if (isDesktop) {
      window.localStorage.setItem(
        sidebarCollapsedStorageKey,
        String(isCollapsed)
      );
    }
  }, [isCollapsed, isDesktop]);

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
