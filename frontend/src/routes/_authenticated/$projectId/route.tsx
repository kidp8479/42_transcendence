// Entry point for the $projectId/ folder.
// Wraps all project tab pages (summary, kanban, list...) in ProjectLayout.
// Redirects to /summary if the user lands on /:projectId directly (no tab selected).
import { createFileRoute, redirect } from '@tanstack/react-router'
import { ProjectLayout } from '../../../components/layout/ProjectLayout'

export const Route = createFileRoute('/_authenticated/$projectId')({
  beforeLoad: ({ location, params }) => {
    if (location.pathname === `/${params.projectId}`) {
      throw redirect({ to: '/$projectId/summary', params })
    }
  },
  component: ProjectLayout,
})
