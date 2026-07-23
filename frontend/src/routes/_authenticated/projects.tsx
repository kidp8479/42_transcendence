// Projects list page (/projects).
// Shows all projects the user belongs to as cards (status, description, deadline).
// Also renders NewProjectCard as the grid's last tile - it toggles inline
// into a creation form itself, so there's no separate route or global modal
// involved (see NewProjectCard.tsx).
//
// description and deadline are real backend fields (Project.description/
// deadline in schema.prisma). progress and memberCount are not - neither
// column/computation exists in the backend yet, so PLACEHOLDER_STATS below
// is a fixed stand-in just to keep the card layout complete, not real data.
import { createFileRoute, useLoaderData, useRouter } from "@tanstack/react-router";
import {
  NewProjectCard,
  type NewProjectFormValues,
} from "@/components/projects/NewProjectCard";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { createProject } from "@/lib/projectsApi";

// Same fixed placeholder for every project - swap for the real values once
// GET /projects exposes progress and a member count (see ProjectCard.tsx).
const PLACEHOLDER_STATS = { progress: 0, memberCount: 1 };

export const Route = createFileRoute("/_authenticated/projects")({
  component: ProjectsPage,
});

function ProjectsPage() {
  // Same project list the sidebar renders - already fetched once by the
  // _authenticated loader (real GET /projects, see lib/projectsApi.ts) -
  // reused here instead of inventing ids, so every card's link resolves to
  // a real project (see ProjectRow in components/navigation/SideBarCmp.tsx).
  const projects = useLoaderData({ from: "/_authenticated" });
  const router = useRouter();

  // onManageMembers/onDeleteProject below are still placeholders - no
  // update/delete-membership endpoints wired up on the frontend yet.
  async function handleCreateProject(values: NewProjectFormValues) {
    try {
      await createProject(values);
      // The list this page (and the sidebar) reads comes from the
      // /_authenticated loader, cached by the router - invalidate() re-runs
      // it so the new project shows up without a full page reload.
      await router.invalidate();
    } catch (error) {
      console.error("Failed to create project:", error);
    }
  }

  return (
    <>
      <div className="p-6 mb-2 border-b border-surface-border">
        <h1 className="text-xl font-bold font-mono text-text-primary">
          Projects
        </h1>
        <p className="text-xs text-text-secondary">
          Create, manage, and track all your projects in one place.
        </p>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project, index) => (
            <ProjectCard
              key={project.id}
              // description is nullable on the backend (no seed data for
              // most projects yet) - fall back to a placeholder string
              // here rather than pushing that null-handling into the card.
              project={{
                ...project,
                description: project.description ?? "No description yet.",
                ...PLACEHOLDER_STATS,
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
          <NewProjectCard onCreate={handleCreateProject} />
        </div>
      </div>
    </>
  );
}
