// BehaviourSection.tsx
// Displays project behaviour-related settings inside the Project Settings page.
// Currently deactivated (not rendered) in project-settings.tsx - time
// constraint, and it can't persist anything until Task-level archive support
// and the Kanban board exist.
// TODO: neither toggle is backed by a DB field or API yet, so changes here
// don't persist - needs a settings model (Project fields vs a dedicated
// ProjectSettings model) and endpoints before this can go live. Kept as a
// separate section from the MVP member/status management above since that
// backend decision affects multiple other features (Kanban, List, Discovery,
// Evaluation Checklist), not just this page.
// TODO: once wired to real endpoints, also broadcast changes over the
// project's websocket room (see ProjectStatusSection.tsx's "project:updated"
// pattern) so other connected members see behaviour changes live, instead of
// only the person who made them.

import { useState } from "react";

import { SettingsSection } from "./SettingsSection";
import { SettingsToggleRow } from "./SettingsToggleRow";
import { IoArchiveSharp } from "react-icons/io5";
import { HiOutlineBell } from "react-icons/hi2";

export function BehaviorSection() {
  const [autoArchive, setAutoArchive] = useState(true);
  const [deadlineReminders, setDeadlineReminders] = useState(true);

  return (
    <SettingsSection
      title="Behavior"
      description="Configure how this project behaves."
    >
      <div className="divide-y divide-surface-border">
        {/* TODO: needs Task-level archive support before this can persist. */}
        <SettingsToggleRow
          icon={<IoArchiveSharp className="h-5 w-5" />}
          iconClassName={
            autoArchive
              ? "!border-brand-500/30 !bg-brand-500/10 !text-brand-500"
              : undefined
          }
          title="Auto-archive tasks when done"
          description="Tickets moved to 'Completed' are automatically archived after 7 days."
          checked={autoArchive}
          onChange={setAutoArchive}
        />

        {/* TODO: needs backend storage + task-view integration before this can persist. */}
        <SettingsToggleRow
          icon={<HiOutlineBell className="h-5 w-5" />}
          iconClassName={
            deadlineReminders
              ? "!border-brand-500/30 !bg-brand-500/10 !text-brand-500"
              : undefined
          }
          title="Deadline reminders"
          description="Show a visual indicator on tasks that are due within 48 hours."
          checked={deadlineReminders}
          onChange={setDeadlineReminders}
        />
      </div>
    </SettingsSection>
  );
}
