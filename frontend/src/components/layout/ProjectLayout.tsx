// Nested wrapper for project sub-pages (tabs: Summary, Discovery, Kanban, List, Calendar, Evaluation Checklist, Project Settings).
// Renders inside AuthenticatedLayout via its <Outlet />.
import { Outlet } from "@tanstack/react-router";

export function ProjectLayout() {
  return (
    <>
      {/* Project tabs nav will go here */}
      <Outlet />
    </>
  );
}
