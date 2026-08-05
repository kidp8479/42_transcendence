// DangerZoneSection.tsx
import { useState } from "react";
import { Button, Modal, TextInput } from "flowbite-react";
import { SettingsSection } from "./SettingsSection";
import { SettingsActionRow } from "./SettingsActionRow";
import { LiaTrashAltSolid } from "react-icons/lia";
import { deleteProject } from "@/lib/projectsApi";
import { useToast } from "@/hooks/useToast";

// Displays destructive project actions inside the Project Settings page.
// Isolated from the other settings sections because these actions are
// irreversible/high-impact - this component owns confirmation UX only for
// those, not general project settings.
//
// OWNER-only (project-settings.tsx gates rendering on role === "OWNER") -
// ADMIN gets "Leave project" instead, from the cogwheel menu on the Projects
// grid (ProjectCard.tsx), which has its own separate delete/leave
// confirmation flow mirroring this one.
//
// KNOWN DUPLICATION: this delete modal's structure and styling (no icon,
// left-aligned text, muted-red confirm button, one-off inline Modal
// className overrides) is hand-duplicated in LeaveProjectModal.tsx and
// RemoveMemberModal.tsx, and also diverges from the unrelated delete-account
// modal in user-settings.tsx (which uses a centered layout, a warning icon,
// Flowbite's solid color="red" button, and a shared theme object). A future
// style or logic fix applied to just this file is easy to leave silently
// unfixed in the other two - check LeaveProjectModal.tsx and
// RemoveMemberModal.tsx before assuming a change here is complete. Not
// unified yet on purpose: doing so means touching shared modal theming
// across several components, scoped as its own follow-up branch rather than
// bundled into feature work.

interface DangerZoneSectionProps {
  projectId: string;
  projectName: string;
  onDeleteProjectSuccess: () => void;
}

export function DangerZoneSection({
  projectId,
  projectName,
  onDeleteProjectSuccess,
}: DangerZoneSectionProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const { showToast } = useToast();

  const canConfirmDelete = confirmText.trim() === projectName;

  function handleOpenDeleteModal() {
    setConfirmText("");
    setShowDeleteModal(true);
  }

  function handleCloseDeleteModal() {
    setShowDeleteModal(false);
    setConfirmText("");
  }

  // DELETE /api/projects/:id (projectsApi.ts) - requires typing the exact
  // project name first. On success the caller (project-settings.tsx)
  // redirects back to /projects, which - via the existing "project:deleted"
  // websocket sync - also disappears live for every other connected member.
  async function handleDeleteProject() {
    if (!canConfirmDelete) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteProject(projectId);
      handleCloseDeleteModal();
      onDeleteProjectSuccess();
    } catch (error) {
      showToast({
        type: "error",
        message:
          error instanceof Error ? error.message : "Failed to delete project",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <SettingsSection title="Danger Zone" variant="danger">
      <div className="divide-y divide-red-500/30">
        <SettingsActionRow
          title="Delete project"
          description="Permanently delete this project and all its data. This cannot be undone."
          icon={<LiaTrashAltSolid className="h-5 w-5" />}
          iconClassName="
			!border-red-500/30
			!bg-red-500/10
			!text-red-400
		  "
        >
          <Button
            type="button"
            onClick={handleOpenDeleteModal}
            className="
				border
				border-red-500/30
				bg-red-500/10
				text-red-400
				hover:bg-red-500/20
				dark:border-red-500/30
				dark:bg-red-500/10
				dark:text-red-500
				dark:hover:bg-transparent
				focus-visible:!outline-none
				focus-visible:!ring-0
				focus-visible:!ring-red-500/20
				dark:focus:!ring-red-500/20
				inline-flex
				items-center
				gap-2
			"
          >
            <LiaTrashAltSolid className="h-5 w-5" />
            Delete project
          </Button>
        </SettingsActionRow>
        <Modal
          show={showDeleteModal}
          size="md"
          popup
          onClose={handleCloseDeleteModal}
          className="[&>div>div]:!bg-surface-raised"
        >
          <div
            className="
			    space-y-4
				rounded-lg
				border
				border-control-border
				p-4
			  "
          >
            <h3 className="text-sm font-semibold text-text-primary">
              Delete project?
            </h3>

            <p className="text-xs text-text-secondary">
              Type{" "}
              <span className="font-semibold text-text-primary">
                {projectName}
              </span>{" "}
              to confirm deletion. This action cannot be undone.
            </p>
            <TextInput
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={projectName}
              aria-label="Type project name to confirm deletion"
              color="none"
              theme={{
                field: {
                  input: {
                    base: `
						    !border-control-border
						    !bg-surface-overlay
							!text-text-primary
							placeholder:!text-text-secondary
							focus:!border-brand-500
							focus-visible:!ring-0
							focus-visible:!outline-none
						  `,
                  },
                },
              }}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                disabled={isDeleting}
                onClick={handleCloseDeleteModal}
                className="
				  !h-8
				  !px-3
				  !py-1
				  !text-xs
				  !rounded-md
				  !border
				  !border-control-border
				  !bg-surface-overlay
				  !text-text-secondary
				  hover:!bg-surface-raised
				  hover:!border-brand-700
				  hover:!text-brand-700
				  focus:!ring-0
				  transition-colors
                "
              >
                Cancel
              </Button>

              <Button
                type="button"
                disabled={!canConfirmDelete || isDeleting}
                onClick={() => void handleDeleteProject()}
                className="
				  !h-8
				  !px-3
				  !py-1
				  !text-xs
				  !rounded-md
				  border
				  border-red-500/30
				  bg-red-500/10
				  text-red-400
				  hover:bg-red-500/20
				  dark:border-red-500/30
				  dark:bg-red-500/10
				  dark:text-red-500
				  dark:hover:bg-red-500/20
				  focus-visible:!outline-none
				  focus-visible:!ring-2
				  focus-visible:!ring-red-500
				  dark:focus:!ring-red-500
				  inline-flex
				  items-center
				  gap-2
				"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </SettingsSection>
  );
}
