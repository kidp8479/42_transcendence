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
      and caused an unwanted horizontal scrollbar.
      This row and <main> have no explicit height of their own - on desktop
      the sidebar's md:min-h-[calc(100vh-133px)] + md:self-stretch give this
      flex row a floor of one viewport (matching the header/footer it sits
      between), but let it grow taller to match whatever <main>'s real content
      needs (e.g. a long Kanban board), so the sidebar's own panel always
      spans the row's full height instead of stopping short and leaving a
      gap once the page scrolls past one viewport. Below md nothing bounds
      it and the page scrolls the normal way regardless. */}
      <main className="scrollbar-thin-surface relative min-w-0 flex-1 min-h-0 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
