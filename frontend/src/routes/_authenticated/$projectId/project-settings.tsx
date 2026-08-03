// Project settings tab (/:projectId/project-settings).
// Configures a specific project: visibility toggles, behaviour, project status (finish/archive), danger zone (delete).
// Not to be confused with user-settings.tsx which is for personal account settings.
import {
  createFileRoute,
  useLoaderData,
  useNavigate,
} from "@tanstack/react-router";

import { ProjectStatusSection } from "@/components/project-settings/ProjectStatusSection";
import { MembersSection } from "@/components/project-settings/MembersSection";
import { BehaviorSection } from "@/components/project-settings/BehaviorSection";
import { DangerZoneSection } from "@/components/project-settings/DangerZoneSection";

export const Route = createFileRoute(
  "/_authenticated/$projectId/project-settings"
)({
  component: ProjectSettingsPage,
});

function ProjectSettingsPage() {
  const { projectId } = Route.useParams();
  // Shared with ProjectLayout - fetched by the parent route's loader and
  // kept live: AuthenticatedLayout's "project:updated" socket listener
  // calls router.invalidate() on every status change, which reruns this
  // loader for every viewer, not just whoever clicked the button.
  const project = useLoaderData({ from: "/_authenticated/$projectId" });
  const navigate = useNavigate();

  return (
    <div className="w-full space-y-6">
      <MembersSection
        projectId={projectId}
        onLeaveProjectSuccess={() => navigate({ to: "/projects" })}
      />

      <BehaviorSection />

      <ProjectStatusSection
        projectId={projectId}
        status={project.status}
        role={project.role}
        isArchived={project.isArchived}
      />

      {project.role === "OWNER" && (
        <DangerZoneSection
          projectId={projectId}
          projectName={project.name}
          onDeleteProjectSuccess={() => navigate({ to: "/projects" })}
        />
      )}
    </div>
  );
}
