// DangerZoneSection.tsx
import { useState } from "react";
import { Button, Modal, TextInput } from "flowbite-react";
import { SettingsSection } from "./SettingsSection";
import { SettingsActionRow } from "./SettingsActionRow";
import { LiaTrashAltSolid } from "react-icons/lia";
import { deleteProject } from "@/lib/projectsApi";

// Displays destructive project actions inside the Project Settings page.
// This section is intentionally isolated from the other settings because these
// actions have irreversible or high-impact consequences.

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

  const canConfirmDelete = confirmText.trim() === projectName;

  function handleOpenDeleteModal() {
    setConfirmText("");
    setShowDeleteModal(true);
  }

  function handleCloseDeleteModal() {
    setShowDeleteModal(false);
    setConfirmText("");
  }

  async function handleDeleteProject() {
    if (!canConfirmDelete) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteProject(projectId);
      handleCloseDeleteModal();
      onDeleteProjectSuccess();
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
                onClick={handleDeleteProject}
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

// Current actions:
// - Delete project
//   => permanently removes the project and its related data.
//   => requires the user to type the exact project name before confirming.
//   => uses the existing deleteProject API from projectsApi.ts.
//
// The delete confirmation UX was previously implemented inside ProjectCard.tsx.
// The project management flow was changed so that both:
// - "Manage members"
// - "Delete project"
//
// from the project card dropdown navigate to the Project Settings page.
// The actual delete action now lives here instead of being performed inline
// from the projects list.
//
// Permissions:
// - Only ADMIN project members should see and use destructive actions.
// - The frontend hides/disables the controls for non-ADMIN users.
// - The backend remains responsible for enforcing authorization.
//
// After successful deletion:
// - the user should be redirected back to the projects list
// - the deleted project should no longer appear in active project views
//
// This component should not contain general project settings logic.
// It only owns dangerous/destructive actions that require extra confirmation.
