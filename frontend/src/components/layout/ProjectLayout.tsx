// Nested wrapper for project sub-pages (tabs: Overview, Kanban, List, Calendar, Evaluation Checklist, Settings).
// Renders inside AuthenticatedLayout via its <Outlet />.
import { Outlet } from '@tanstack/react-router'

export function ProjectLayout() {
  return (
    <>
      {/* Project tabs nav will go here */}
      <Outlet />
    </>
  )
}
