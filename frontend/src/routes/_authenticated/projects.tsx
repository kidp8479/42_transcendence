// Projects list page (/projects).
// Shows all projects the user belongs to as cards (status, progress, members, deadline).
// Also contains the "New project" button which opens a creation modal (not a separate route).
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/projects")({
  component: ProjectsPage,
});

function ProjectsPage() {
  return <div className="text-brand-700">Hello "/projects"!</div>;	// random color, don't pay attention
}
