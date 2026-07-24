// Projects list page (/projects).
// Shows all projects the user belongs to as cards (status, description, deadline).
// Also renders NewProjectCard as the grid's last tile - it toggles inline
// into a creation form itself, so there's no separate route or global modal
// involved (see NewProjectCard.tsx).
//
// description, deadline, progress, and memberCount are all real backend
// fields (see lib/projectsApi.ts) - progress is computed from
// EvaluationChecklistItem.isChecked, memberCount from the ProjectMember count.
import {
  createFileRoute,
  useLoaderData,
  useRouter,
  useNavigate,
} from "@tanstack/react-router";
import {
  NewProjectCard,
  type NewProjectFormValues,
} from "@/components/projects/NewProjectCard";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { createProject, deleteProject, type Project } from "@/lib/projectsApi";

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
  const navigate = useNavigate();

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

  async function handleDeleteProject(project: Project) {
    if (!window.confirm(`Delete "${project.name}"? This cannot be undone.`))
      return;
    try {
      await deleteProject(project.id);
      await router.invalidate();
    } catch (error) {
      console.error("Failed to delete project:", error);
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
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={{
                ...project,
                description: project.description ?? "No description yet.",
              }}
              canManageProject={project.role === "ADMIN"}
              onManageMembers={() =>
                navigate({
                  to: "/$projectId/project-settings",
                  params: { projectId: project.id },
                })
              }
              onDeleteProject={() => handleDeleteProject(project)}
            />
          ))}
          <NewProjectCard onCreate={handleCreateProject} />
        </div>
      </div>
    </>
  );
}
