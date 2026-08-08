// Wrapper for all authenticated pages (login required).
// The root application shell owns the authentication-aware header and footer.
import { useEffect, useRef } from "react";
import { Outlet, useRouter } from "@tanstack/react-router";
import { SideBarCmp } from "@/components/navigation/SideBarCmp";
import { getRealtimeSocket } from "@/lib/realtimeSocket";
import { useSafeRouterInvalidate } from "@/hooks/useSafeRouterInvalidate";
import { authSessionResource } from "@/lib/authState";
import { useToast } from "@/hooks/useToast";

export function AuthenticatedLayout() {
  // router is stable across renders; safeInvalidateRouter/showToast aren't
  // (new closure every render), so those two go through refs instead.
  const router = useRouter();
  const safeInvalidateRouter = useSafeRouterInvalidate();
  const safeInvalidateRouterRef = useRef(safeInvalidateRouter);
  safeInvalidateRouterRef.current = safeInvalidateRouter;
  const { showToast } = useToast();
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

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
    //
    // Guards a failed refresh with a toast instead of an unhandled
    // rejection (the acting user's own action is excluded server-side, see
    // RealtimeService.emitToProject - this is a backstop, not the main fix).
    const invalidate = () => {
      void safeInvalidateRouterRef.current();
    };

    // Live getter, not a snapshot - always reflects whichever route is
    // active when an event arrives, not whichever was active on mount.
    function currentProjectId(): string | undefined {
      const match = router.state.matches.find(
        (m) => m.routeId === "/_authenticated/$projectId"
      );
      return (match?.params as { projectId?: string } | undefined)?.projectId;
    }

    // project:deleted/member-removed can mean the project I'm CURRENTLY
    // viewing is gone - refreshing it 404s. Deciding refresh-vs-navigate
    // here, in one place, avoids the two racing (a prior version split this
    // across two components' listeners on the same event; whichever fired
    // first won, and the refresh usually did).
    async function leaveDeadProject(message: string) {
      showToastRef.current({ type: "error", message });
      await router.navigate({ to: "/projects" });
      // Now safe: the dead project's route is no longer matched, so this
      // can't 404 against it the way refreshing before navigating did.
      void safeInvalidateRouterRef.current();
    }

    function handleProjectDeleted(payload: unknown) {
      const affectedId =
        typeof payload === "object" && payload !== null && "id" in payload
          ? payload.id
          : undefined;
      if (affectedId === currentProjectId()) {
        void leaveDeadProject("This project was deleted.");
        return;
      }
      invalidate();
    }

    function handleMemberRemoved(payload: unknown) {
      const removed =
        typeof payload === "object" && payload !== null
          ? (payload as { projectId?: unknown; userId?: unknown })
          : {};
      const authState = authSessionResource.getState();
      const currentUserId =
        authState?.status === "authenticated"
          ? authState.session.user.id
          : null;
      // Both conditions: projectId alone would also match someone ELSE
      // being removed - MembersSection's own listener already handles that.
      if (
        removed.projectId === currentProjectId() &&
        removed.userId === currentUserId
      ) {
        void leaveDeadProject("You were removed from this project.");
        return;
      }
      invalidate();
    }

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
    socket.on("project:member-removed", handleMemberRemoved);
    socket.on("project:member-role-changed", invalidate);
    socket.on("project:deleted", handleProjectDeleted);

    return () => {
      socket.off("project:updated", invalidate);
      socket.off("project:member-added", invalidate);
      socket.off("project:member-removed", handleMemberRemoved);
      socket.off("project:member-role-changed", invalidate);
      socket.off("project:deleted", handleProjectDeleted);
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
