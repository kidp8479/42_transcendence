// Nested wrapper for project sub-pages (tabs: Summary, Discovery, Kanban, List, Calendar, Evaluation Checklist, Project Settings).
// Renders inside AuthenticatedLayout via its <Outlet />.
import { Outlet, useLoaderData } from "@tanstack/react-router";
import { ProjectTabs } from "@/components/navigation/ProjectTabs";

export function ProjectLayout() {
  // real data now: fetched by the route's loader (GET /api/projects/:id),
  // see routes/_authenticated/$projectId/route.tsx
  const project = useLoaderData({ from: "/_authenticated/$projectId" });

  return (
    // h-full: <main> (AuthenticatedLayout) already has a real, flex-computed
    // height, so this resolves against it directly. Splitting into a flex
    // column lets the content area grow to fill whatever's left after the
    // title/tabs - tabs with little content (ex: Calendar) can now stretch
    // instead of leaving empty space below. Tabs with more content than fits
    // are unaffected: a flex item's default min-height is its own content
    // size, so it still grows past flex-1 and the page still scrolls
    // normally, exactly like before this change.
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-6 pt-6 mb-5">
        <h1 className="text-xl font-bold font-mono text-text-primary">
          {project.name}
        </h1>
        {project.description && (
          <p className="text-xs text-text-secondary">{project.description}</p>
        )}
      </div>
      <div className="shrink-0">
        <ProjectTabs />
      </div>
      {/* Split in two on purpose.
          The ANCHOR carries no padding: min-h-0 keeps title/tabs from being
          pushed along by a tall tab. `relative` makes it the containing block
          for the drawers (DrawerShell is absolute), spanning tab bar to footer.
          Internal (non-page) scrolling only happens for tabs short enough to
          fit main's real rendered height - main has no hard cap (see
          AuthenticatedLayout.tsx), so a taller tab just grows the page and the
          document scrolls, same as any page without this wrapper. Kanban's own
          per-column scrolling is separate and unrelated to this anchor.

          z-40, not left at auto: `isolate` makes this anchor its own stacking
          context, so a drawer's own z-40 (claimed INSIDE it) no longer competes
          with anything outside - the anchor as a whole does now, per its own
          (previously unstated) z-index, and lost to the mobile sidebar's z-30
          backdrop (see SideBarCmp.tsx's own comment on this same tradeoff).
          z-40 matches the drawer's own value and sits below the header/sidebar's
          z-50, so an open drawer still beats that backdrop without covering
          the header or an open sidebar. */}
      <div className="relative isolate z-40 min-h-0 flex-1">
        <div className="scrollbar-thin-surface h-full overflow-y-auto p-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
