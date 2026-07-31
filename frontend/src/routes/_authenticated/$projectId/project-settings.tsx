// Project settings tab (/:projectId/project-settings).
// Configures a specific project: visibility toggles, behaviour, project status (finish/archive), danger zone (delete).
// Not to be confused with user-settings.tsx which is for personal account settings.
import { createFileRoute } from "@tanstack/react-router";

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

  return (
    <div className="w-full space-y-6">
      <MembersSection projectId={projectId} />

      <BehaviorSection />

      <ProjectStatusSection />

      <DangerZoneSection projectId={projectId} />
    </div>
  );
}
