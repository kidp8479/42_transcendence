// Wrapper for all authenticated pages (login required).
// The root application shell owns the authentication-aware header and footer.
import { Outlet } from "@tanstack/react-router";
import { SideBarCmp } from "@/components/navigation/SideBarCmp";

export function AuthenticatedLayout() {
  return (
    <div className="flex min-h-0 flex-1">
      <SideBarCmp />
      {/* relative: positioning ancestor for drawers (ex: CalendarEventDrawer)
      rendered inside the Outlet below - an expanded drawer's "w-full" then
      naturally stops at the sidebar's edge (or fills the whole area if the
      sidebar is collapsed) instead of covering it, since main only spans the
      space to the sidebar's right to begin with.
      overflow-x-hidden (not full overflow-hidden, vertical scroll stays
      untouched): a closed drawer sits translated off to the right
      (translate-x-full) - without clipping, that translated-away panel
      still extends the page's horizontal scrollable area even while
      invisible, which broke the whole layout (unwanted horizontal scrollbar,
      sidebar pushed out of view). */}
      <main className="relative min-w-0 flex-1 min-h-0 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
