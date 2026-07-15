// Nested wrapper for project sub-pages (tabs: Summary, Discovery, Kanban, List, Calendar, Evaluation Checklist, Project Settings).
// Renders inside AuthenticatedLayout via its <Outlet />.
import { Outlet, useLoaderData } from "@tanstack/react-router";
import { ProjectTabs } from "@/components/navigation/ProjectTabs";

export function ProjectLayout() {
  // real data now: fetched by the route's loader (GET /api/projects/:id),
  // see routes/_authenticated/$projectId/route.tsx
  const project = useLoaderData({ from: "/_authenticated/$projectId" });

  return (
    <>
      <div className="px-6 pt-6 mb-5">
        <h1 className="text-xl font-bold font-mono text-text-primary">
          {project.name}
        </h1>
        {project.description && (
          <p className="text-xs text-text-secondary">{project.description}</p>
        )}
      </div>
      <ProjectTabs />
      <div className="p-6">
        <Outlet />
      </div>
    </>
  );
}
