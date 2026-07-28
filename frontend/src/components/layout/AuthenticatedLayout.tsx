// Wrapper for all authenticated pages (login required).
// The root application shell owns the authentication-aware header and footer.
import { Outlet } from "@tanstack/react-router";
import { SideBarCmp } from "@/components/navigation/SideBarCmp";

export function AuthenticatedLayout() {
  return (
    <div className="flex min-h-0 flex-1">
      <SideBarCmp />
      {/* relative: positions drawers (ex: CalendarEventDrawer) to this area,
      so an expanded drawer stops at the sidebar's edge instead of covering it.
      overflow-x-hidden: a closed drawer still sits translated off-screen to
      the right, which without clipping stretched the page's scrollable area
      and caused an unwanted horizontal scrollbar. */}
      <main className="relative min-w-0 flex-1 min-h-0 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
