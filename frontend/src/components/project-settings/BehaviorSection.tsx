// BehaviourSection.tsx
// Displays project behaviour-related settings inside the Project Settings page.

import { useState } from "react";

import { SettingsSection } from "./SettingsSection";
import { SettingsToggleRow } from "./SettingsToggleRow";

export function BehaviorSection() {
  const [autoArchive, setAutoArchive] = useState(true);
  const [deadlineReminders, setDeadlineReminders] = useState(true);

  return (
    <SettingsSection
      title="Behavior"
      description="Configure how this project behaves."
    >
      <div className="divide-y divide-surface-border">
        <SettingsToggleRow
          title="Auto-archive tasks when done"
          description="Tickets moved to 'Completed' are automatically archived after 7 days."
          checked={autoArchive}
          onChange={setAutoArchive}
        />

        <SettingsToggleRow
          title="Deadline reminders"
          description="Show a visual indicator on tasks that are due within 48 hours."
          checked={deadlineReminders}
          onChange={setDeadlineReminders}
        />
      </div>
    </SettingsSection>
  );
}

// Current behaviour options shown in the design:
// - Auto-archive tasks when done
//   => tasks moved to Completed would automatically be archived after 7 days.
//   => requires Task-level archive support, which does not exist yet.
//
// - Deadline reminders
//   => displays a visual indicator for tasks approaching their deadline
//      (within 48 hours).
//   => requires backend storage for the setting and integration with task views.
//
// Because these settings do not currently have database fields or API endpoints,
// this component should not persist changes yet.
// The UI can be implemented as a placeholder until the team decides:
// - where project behaviour settings should be stored
//   (Project fields vs a separate ProjectSettings model)
// - which features consume these values
//
// When backend support exists, this component should:
// - receive the current project settings as props or load them through an API hook
// - update settings through a dedicated settings API
// - respect project permissions (ADMIN only for modifying settings)
//
// Visibility and Behaviour settings were intentionally separated from the MVP
// member/status management because their implementation affects multiple features
// (Kanban, List, Discovery, Evaluation Checklist).
