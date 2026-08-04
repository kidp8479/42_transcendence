// ProjectStatusSection.tsx
import { useState } from "react";
import { Button, Tooltip } from "flowbite-react";
import { SettingsActionRow } from "./SettingsActionRow";
import { SettingsSection } from "./SettingsSection";
import { HiOutlineArchive, HiOutlineShieldCheck } from "react-icons/hi";
import {
  updateProject,
  type Project,
  type ProjectStatus,
} from "@/lib/projectsApi";
import { useToast } from "@/hooks/useToast";
import { useSafeRouterInvalidate } from "@/hooks/useSafeRouterInvalidate";

// Displays project lifecycle management actions inside the Project Settings
// page. Both actions below go through PATCH /api/projects/:id
// (projectsApi.ts), restricted to OWNER/ADMIN backend-side; the frontend
// hides the buttons for MEMBER as UX only. Member management and destructive
// actions are handled by MembersSection.tsx and DangerZoneSection.tsx, not
// here.

interface ProjectStatusSectionProps {
  projectId: string;
  status: ProjectStatus;
  role: Project["role"];
  isArchived: boolean;
}

export function ProjectStatusSection({
  projectId,
  status,
  role,
  isArchived,
}: ProjectStatusSectionProps) {
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isUpdatingArchive, setIsUpdatingArchive] = useState(false);
  const { showToast } = useToast();
  const safeInvalidateRouter = useSafeRouterInvalidate();
  // "Mark as finished" maps to Project.status = COMPLETED; other statuses
  // (e.g. REVIEW) are set/interpreted elsewhere, not by this component.
  const isFinished = status === "COMPLETED";
  const canManageLifecycle = role === "OWNER" || role === "ADMIN";

  async function handleToggleFinished() {
    setIsUpdatingStatus(true);
    try {
      await updateProject(projectId, {
        status: isFinished ? "IN_PROGRESS" : "COMPLETED",
      });
    } catch (error) {
      showToast({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to update project status",
      });
      setIsUpdatingStatus(false);
      return;
    }
    showToast({
      type: "success",
      message: isFinished
        ? "Project marked as unfinished"
        : "Project marked as finished",
    });
    await safeInvalidateRouter();
    setIsUpdatingStatus(false);
  }

  async function handleToggleArchive() {
    setIsUpdatingArchive(true);
    try {
      await updateProject(projectId, {
        isArchived: !isArchived,
      });
    } catch (error) {
      showToast({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to update project status",
      });
      setIsUpdatingArchive(false);
      return;
    }
    showToast({
      type: "success",
      message: isArchived ? "Project restored" : "Project archived",
    });
    await safeInvalidateRouter();
    setIsUpdatingArchive(false);
  }
  return (
    <SettingsSection
      title="Project Status"
      description="Manage the lifecycle of this project."
    >
      <div className="divide-y divide-surface-border">
        <SettingsActionRow
          title="Mark project as finished"
          description="Flags the project as complete on the dashboard and projects page. Removes it from the sidebar."
          icon={<HiOutlineShieldCheck className="h-5 w-5" />}
          iconClassName={
            isFinished
              ? "!border-brand-500/30 !bg-brand-500/10 !text-brand-500"
              : undefined
          }
        >
          {canManageLifecycle ? (
            <Button
              onClick={handleToggleFinished}
              disabled={isUpdatingStatus}
              className="
			  !border
			  !border-surface-border
			  !bg-surface-overlay
			  !text-text-primary
		      hover:!bg-transparent
			  hover:!border-brand-500
			  hover:!text-brand-500
			  focus-visible:!outline-none
			  focus-visible:!ring-2
		      focus-visible:!ring-brand-500/20
			  dark:focus:!ring-brand-800
			"
            >
              {isUpdatingStatus
                ? "Saving..."
                : isFinished
                  ? "Mark as unfinished"
                  : "Mark as finished"}
            </Button>
          ) : (
            // MEMBER can't act here - without this, the icon/title/description
            // show up with nothing next to them, reading as broken instead of
            // "not your role." Same slot as the real button, disabled, with a
            // tooltip explaining why.
            <Tooltip content="Only the project owner or admin can change this">
              <Button
                disabled
                className="!border !border-surface-border !bg-surface-overlay !text-text-primary"
              >
                {isFinished ? "Mark as unfinished" : "Mark as finished"}
              </Button>
            </Tooltip>
          )}
        </SettingsActionRow>

        <SettingsActionRow
          title="Archive project"
          description="Hide from active views without deleting data. Can be restored anytime."
          icon={<HiOutlineArchive className="h-5 w-5" />}
          iconClassName={
            isArchived
              ? "!border-yellow-400/30 !bg-yellow-400/10 !text-yellow-400"
              : undefined
          }
        >
          {canManageLifecycle ? (
            <Button
              onClick={handleToggleArchive}
              disabled={isUpdatingArchive}
              className="
			  !border
		      !border-surface-border
			  !bg-surface-overlay
			  !text-text-primary
			  hover:!bg-transparent
			  hover:!border-yellow-400
			  hover:!text-yellow-400
		      focus-visible:!outline-none
			  focus-visible:!ring-2
			  focus-visible:!ring-yellow-500/20
			  dark:focus:!ring-yellow-500/20
			  inline-flex
			  items-center
			  gap-2
			"
            >
              <HiOutlineArchive className="h-4 w-4" />
              {isUpdatingArchive
                ? "Saving..."
                : isArchived
                  ? "Restore"
                  : "Archive"}
            </Button>
          ) : (
            // Same reasoning as the finished-toggle branch above.
            <Tooltip content="Only the project owner or admin can change this">
              <Button
                disabled
                className="!border !border-surface-border !bg-surface-overlay !text-text-primary inline-flex items-center gap-2"
              >
                <HiOutlineArchive className="h-4 w-4" />
                {isArchived ? "Restore" : "Archive"}
              </Button>
            </Tooltip>
          )}
        </SettingsActionRow>
      </div>
    </SettingsSection>
  );
}
