// Wrapper for all authenticated pages (login required).
// The root application shell owns the authentication-aware header and footer.
import { Outlet } from "@tanstack/react-router";
import { SideBarCmp } from "@/components/navigation/SideBarCmp";

export function AuthenticatedLayout() {
  return (
    <div className="flex min-h-0 flex-1">
      <SideBarCmp />
      {/* The scroller for the pages that own no layout of their own (projects,
      dashboard, search). Kept a plain block, not a flex column: those pages
      return fragments of sibling divs that would silently become flex items.
      Project tabs bring their own bounded scroller (ProjectLayout).
      overflow-x-hidden: a closed drawer still sits translated off-screen to
      the right, which without clipping stretched the page's scrollable area
      and caused an unwanted horizontal scrollbar. It also makes overflow-y
      compute to auto, which is what lets this scroll at all. */}
      <main className="relative min-w-0 flex-1 min-h-0 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
