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

    // sync: true on every listener below - router.invalidate() defaults to a
    // BACKGROUND reload: the returned promise resolves immediately without
    // waiting for the refetch to actually land in the store, and any
    // non-redirect error from that background reload is silently swallowed
    // (see TanStack Router's loadRouteMatch). That's fine for the acting
    // user's own optimistic UI, but these listeners exist specifically so
    // OTHER connected users see the change live - without sync: true, the
    // sidebar/project list can go on showing stale data indefinitely with no
    // error anywhere to explain why.
    const invalidate = () => {
      router.invalidate({ sync: true });
    };

    // Named handler + socket.off(event, handler) below, not socket.off(event):
    // getRealtimeSocket() is a shared singleton - other components (e.g.
    // MembersSection) register their own listeners for these same event names
    // on the same socket. socket.off(event) with no handler removes EVERY
    // listener for that event, not just this component's, so it was silently
    // unregistering these listeners the moment MembersSection unmounted -
    // this component itself never remounts, so once that happened, cross-user
    // sync stayed broken for the rest of the session with zero error anywhere.
    socket.on("project:updated", invalidate);
    socket.on("project:member-added", invalidate);
    socket.on("project:member-removed", invalidate);
    socket.on("project:member-role-changed", invalidate);
    socket.on("project:deleted", invalidate);

    return () => {
      socket.off("project:updated", invalidate);
      socket.off("project:member-added", invalidate);
      socket.off("project:member-removed", invalidate);
      socket.off("project:member-role-changed", invalidate);
      socket.off("project:deleted", invalidate);
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
