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
  useNavigate,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ToggleSwitch } from "flowbite-react";
import {
  NewProjectCard,
  type NewProjectFormValues,
} from "@/components/projects/NewProjectCard";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { createProject, deleteProject, type Project } from "@/lib/projectsApi";
import { removeMember } from "@/lib/projectMembersApi";
import { getSession } from "@/lib/auth";
import { useSafeRouterInvalidate } from "@/hooks/useSafeRouterInvalidate";
import { useToast } from "@/hooks/useToast";

export const Route = createFileRoute("/_authenticated/projects")({
  component: ProjectsPage,
});

function ProjectsPage() {
  // Same project list the sidebar renders - already fetched once by the
  // _authenticated loader (real GET /projects, see lib/projectsApi.ts) -
  // reused here instead of inventing ids, so every card's link resolves to
  // a real project (see ProjectRow in components/navigation/SideBarCmp.tsx).
  const projects = useLoaderData({ from: "/_authenticated" });
  const navigate = useNavigate();
  const safeInvalidateRouter = useSafeRouterInvalidate();
  const { showToast } = useToast();
  const [showArchived, setShowArchived] = useState(false);
  const archivedProjects = projects.filter((project) => project.isArchived);
  const visibleProjects = (
    showArchived
      ? projects.slice()
      : projects.filter((project) => !project.isArchived)
  ).sort((a, b) => Number(a.isArchived) - Number(b.isArchived));
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    getSession()
      .then((session) => setCurrentUserId(session?.user.id ?? null))
      .catch(() => setCurrentUserId(null));
  }, []);

  async function handleCreateProject(values: NewProjectFormValues) {
    try {
      await createProject(values);
      // The list this page (and the sidebar) reads comes from the
      // /_authenticated loader, cached by the router - invalidate() re-runs
      // it so the new project shows up without a full page reload.
      showToast({ type: "success", message: "Project created" });
    } catch (error) {
      showToast({ type: "error", message: errorMessage(error) });
      return false;
    }
    await safeInvalidateRouter();
    return true;
  }

  async function handleDeleteProject(project: Project) {
    try {
      await deleteProject(project.id);
      showToast({ type: "success", message: "Project deleted" });
    } catch (error) {
      showToast({ type: "error", message: errorMessage(error) });
      return false;
    }
    await safeInvalidateRouter();
    return true;
  }

  async function handleLeaveProject(project: Project) {
    if (!currentUserId) {
      showToast({
        type: "error",
        message: "Still loading your session, please try again",
      });
      return false;
    }
    try {
      await removeMember(project.id, currentUserId);
      showToast({ type: "success", message: "Left project" });
    } catch (error) {
      showToast({ type: "error", message: errorMessage(error) });
      return false;
    }
    await safeInvalidateRouter();
    return true;
  }

  return (
    <>
      <div className="p-6 mb-2 border-b border-surface-border flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-mono text-text-primary">
            Projects
          </h1>
          <p className="text-xs text-text-secondary">
            Create, manage, and track all your projects in one place.
          </p>
        </div>

        {archivedProjects.length > 0 && (
          <label className="flex shrink-0 items-center gap-2 text-xs text-text-secondary">
            <ToggleSwitch
              checked={showArchived}
              onChange={setShowArchived}
              color="green"
              sizing="sm"
              label=""
              // Flowbite's default focus ring (group-focus:ring-4) reads as
              // huge next to this small "sm" toggle - shrink it, scoped to
              // this instance only.
              theme={{ toggle: { base: "group-focus:ring-1" } }}
            />
            <span>Include archived</span>
            <span className="rounded-full bg-surface-overlay px-1.5 py-0.5 text-[10px] font-semibold text-text-muted">
              {archivedProjects.length}
            </span>
          </label>
        )}
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={{
                ...project,
                description: project.description ?? "No description yet.",
              }}
              role={project.role}
              onOpenSettings={() =>
                navigate({
                  to: "/$projectId/project-settings",
                  params: { projectId: project.id },
                })
              }
              onDeleteProject={() => handleDeleteProject(project)}
              onLeaveProject={() => handleLeaveProject(project)}
            />
          ))}
          <NewProjectCard onCreate={handleCreateProject} />
        </div>
      </div>
    </>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Project request failed";
}
