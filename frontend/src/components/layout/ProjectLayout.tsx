// Nested wrapper for project sub-pages (tabs: Summary, Discovery, Kanban, List, Calendar, Evaluation Checklist, Project Settings).
// Renders inside AuthenticatedLayout via its <Outlet />.
import { Outlet } from "@tanstack/react-router";
import { ProjectTabs } from "../navigation/ProjectTabs";

export function ProjectLayout() {
  // TEMP mock - will be replaced by GET /api/projects/:id once auth is wired
  const project = {
    name: "ft_transcendence",
    description: "Full-stack web app with real-time multiplayer Pong",
  };

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
