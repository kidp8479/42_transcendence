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
      <div className="flex-1 p-6">
        <Outlet />
      </div>
    </div>
  );
}
