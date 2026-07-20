// Projects list page (/projects).
// Shows all projects the user belongs to as cards (status, progress, members, deadline).
// Also contains the "New project" button which opens a creation modal (not a separate route).
import { createFileRoute, useLoaderData } from "@tanstack/react-router";
import {
  ProjectCard,
  type ProjectCardData,
} from "@/components/projects/ProjectCard";

// Display fields GET /projects doesn't return yet (today's endpoint only
// backs SidebarProject - id/name/status, see lib/projects.ts), keyed by name
// so they can be merged onto the real project below. Matches
// backend/prisma/seed.ts (ft_transcendence: all 5 seed users; minishell: the
// diana/pauline variant, the other minishell seed row has a shorter
// description and 3 members instead; libft: seeded per-user, 1 member here).
const PROJECT_ENRICHMENT: Record<
  string,
  Omit<ProjectCardData, "id" | "name" | "status">
> = {
  ft_transcendence: {
    description:
      "Full-stack web app with real-time multiplayer Pong game and OAuth",
    progress: 68,
    memberCount: 5,
    deadline: "2026-07-12",
    color: 3,
  },
  minishell: {
    description:
      "A minimal bash-like shell with built-ins, pipes, and redirections",
    progress: 92,
    memberCount: 2,
    deadline: "2026-06-28",
    color: 2,
  },
  libft: {
    description: "Custom C standard library reimplementation",
    progress: 100,
    memberCount: 1,
    deadline: "2026-05-01",
    color: 4,
  },
};

// Real seeded projects with no curated entry above (philosophers, push_swap,
// the other minishell...) - still a real id/name/status, just no hand-written
// progress/description yet.
const FALLBACK_ENRICHMENT: Omit<ProjectCardData, "id" | "name" | "status"> = {
  description: "No description yet.",
  progress: 0,
  memberCount: 1,
  deadline: new Date().toISOString(),
  color: 0,
};

export const Route = createFileRoute("/_authenticated/projects")({
  component: ProjectsPage,
});

function ProjectsPage() {
  // Same project list the sidebar renders - already fetched once by the
  // _authenticated loader (real GET /projects, see lib/projects.ts) - reused
  // here instead of inventing ids, so every card's link resolves to a real
  // project (see ProjectRow in components/navigation/SideBarCmp.tsx).
  const projects = useLoaderData({ from: "/_authenticated" });

  return (
    <>
      <div className="p-6 mb-5 border-b border-surface-border">
        <h1 className="text-xl font-bold font-mono text-text-primary">
          Projects
        </h1>
        <p className="text-xs text-text-secondary">
          Create, manage, and track all your projects in one place.
        </p>
      </div>
      <div className="p-6">
        {projects.length === 0 ? (
          <p className="text-sm text-text-muted">No projects yet</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((project, index) => (
              <ProjectCard
                key={project.id}
                project={{
                  ...project,
                  ...(PROJECT_ENRICHMENT[project.name] ?? FALLBACK_ENRICHMENT),
                }}
                // No role field on the API yet (see ProjectCard.tsx) -
                // alternates true/false here only to keep previewing both
                // menu states.
                canManageProject={index % 2 === 0}
                onManageMembers={() =>
                  console.log(`Manage members: ${project.name}`)
                }
                onDeleteProject={() =>
                  console.log(`Delete project: ${project.name}`)
                }
              />
            ))}
          </div>
        )}
        <div>{/* le bouton "New project" qui ouvre un modal */}</div>
      </div>
    </>
  );
}
