// Projects list page (/projects).
// Shows all projects the user belongs to as cards (status, progress, members, deadline).
// Also contains the "New project" button which opens a creation modal (not a separate route).
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/projects")({
  component: ProjectsPage,
});

function ProjectsPage() {
  return <div>Hello "/_authenticated/projects"!</div>;
}
