// DangerZoneSection.tsx
import { Button } from "flowbite-react";
import { SettingsSection } from "./SettingsSection";
import { SettingsActionRow } from "./SettingsActionRow";
// Displays destructive project actions inside the Project Settings page.

// This section is intentionally isolated from the other settings because these
// actions have irreversible or high-impact consequences.

export function DangerZoneSection() {
  return (
    <SettingsSection title="Danger Zone" variant="danger">
      <div className="divide-y divide-red-500/20">
        <SettingsActionRow
          title="Delete project"
          description="Permanently delete this project and all its data. This cannot be undone."
        >
          {/* TODO: Replace default Flowbite button colors with final danger button styling */}
          <Button>Delete project</Button>
        </SettingsActionRow>
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
