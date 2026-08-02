// ProjectStatusSection.tsx
import { Button } from "flowbite-react";
import { SettingsActionRow } from "./SettingsActionRow";
import { SettingsSection } from "./SettingsSection";
import { HiOutlineArchive, HiOutlineShieldCheck } from "react-icons/hi";

// Displays project lifecycle management actions inside the Project Settings page.
//
// This section is responsible for actions that change the current state of a
// project without deleting it.

export function ProjectStatusSection() {
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
        >
          <Button
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
            Mark as finished
          </Button>
        </SettingsActionRow>

        <SettingsActionRow
          title="Archive project"
          description="Hide from active views without deleting data. Can be restored anytime."
          icon={<HiOutlineArchive className="h-5 w-5" />}
        >
          <Button
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
            Archive
          </Button>
        </SettingsActionRow>
      </div>
    </SettingsSection>
  );
}
// Current actions:
// - Mark as finished
//   => updates the project status to COMPLETED.
//   => uses the existing PATCH /api/projects/:id endpoint.
//
// - Archive
//   => hides the project from active project views while keeping the data.
//   => uses the existing PATCH /api/projects/:id endpoint with isArchived: true.
//
// API interactions are handled through projectsApi.ts:
//
// PATCH /api/projects/:id
//      => updates project fields provided in the request body.
//      => only ADMIN project members are allowed to perform updates.
//
// Permissions:
// - All project members can view the Settings page.
// - Only ADMIN users should see and use lifecycle controls.
// - Frontend checks are only for user experience.
// - Backend authorization remains the source of truth.
//
// State updates:
// - After a successful mutation, the UI should refresh the project data so the
//   displayed status reflects the backend state.
// - The component should not directly modify project state locally without
//   confirmation from the API response.
//
// Notes:
// - "Mark as finished" currently maps to Project.status = COMPLETED.
// - The meaning of other statuses (for example REVIEW) is handled elsewhere
//   and is not part of this component.
//
// This component only manages project lifecycle actions.
// Member management and destructive actions are handled by:
// - MembersSection.tsx
// - DangerZoneSection.tsx
