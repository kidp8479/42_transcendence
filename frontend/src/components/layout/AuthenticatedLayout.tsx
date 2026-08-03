// Wrapper for all authenticated pages (login required).
// The root application shell owns the authentication-aware header and footer.
import { useEffect } from "react";
import { Outlet, useRouter } from "@tanstack/react-router";
import { SideBarCmp } from "@/components/navigation/SideBarCmp";
import { getRealtimeSocket } from "@/lib/realtimeSocket";

export function AuthenticatedLayout() {
  const router = useRouter();

  useEffect(() => {
    const socket = getRealtimeSocket();

    socket.on("project:updated", () => {
      router.invalidate();
    });

    socket.on("project:member-added", () => {
      router.invalidate();
    });

    socket.on("project:member-removed", () => {
      router.invalidate();
    });

    socket.on("project:deleted", () => {
      router.invalidate();
    });

    return () => {
      socket.off("project:updated");
      socket.off("project:member-added");
      socket.off("project:member-removed");
      socket.off("project:deleted");
    };
  }, [router]);

  return (
    <div className="flex min-h-0 flex-1">
      <SideBarCmp />
      {/* The scroller for the pages that own no layout of their own (projects,
      dashboard, search). Kept a plain block, not a flex column: those pages
      return fragments of sibling divs that would silently become flex items.
      Project tabs bring their own bounded scroller (ProjectLayout).
      overflow-x-hidden: a closed drawer still sits translated off-screen to
      the right, which without clipping stretched the page's scrollable area
      and caused an unwanted horizontal scrollbar.
      This row and <main> have no explicit height of their own - on desktop
      the sidebar's own h-[calc(100vh-133px)] + sticky + self-start is what
      keeps it pinned while the page scrolls (self-stretch was tried to also
      close its cosmetic bottom gap, but that made it exactly as tall as its
      container, leaving sticky no room to float - reverted, pinning matters
      more). Below md nothing bounds this row, page scrolls normally. */}
      <main className="scrollbar-thin-surface relative min-w-0 flex-1 min-h-0 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
