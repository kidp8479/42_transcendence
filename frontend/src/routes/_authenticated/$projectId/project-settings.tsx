// Project settings tab (/:projectId/project-settings).
// Configures a specific project: visibility toggles, behaviour, project status (finish/archive), danger zone (delete).
// Not to be confused with user-settings.tsx which is for personal account settings.
import { createFileRoute } from "@tanstack/react-router";

import { ProjectStatusSection } from "@/components/project-settings/ProjectStatusSection";
import { MembersSection } from "@/components/project-settings/MembersSection";
import { BehaviorSection } from "@/components/project-settings/BehaviorSection";
import { DangerZoneSection } from "@/components/project-settings/DangerZoneSection";
import { getProject, type Project } from "@/lib/projectsApi";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_authenticated/$projectId/project-settings"
)({
  component: ProjectSettingsPage,
});

function ProjectSettingsPage() {
  const { projectId } = Route.useParams();
  const [project, setProject] = useState<Project | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    getProject(projectId).then(setProject).catch(console.error);
  }, [projectId]);

  if (!project) {
    return null;
  }
  return (
    <div className="w-full space-y-6">
      <MembersSection projectId={projectId} />

      <BehaviorSection />

      <ProjectStatusSection />
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
