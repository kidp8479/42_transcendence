// Project settings tab (/:projectId/project-settings).
// Configures a specific project: visibility toggles, behaviour, project status (finish/archive), danger zone (delete).
// Not to be confused with user-settings.tsx which is for personal account settings.
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_authenticated/$projectId/project-settings',
)({
  component: ProjectSettingsPage,
})

function ProjectSettingsPage() {
  return <div>Hello "/_authenticated/$projectId/project-settings"!</div>
}
