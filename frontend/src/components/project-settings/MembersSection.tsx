// MembersSection.tsx

import { SettingsSection } from "./SettingsSection";
import { MemberListItem } from "./MemberListItem";
import { useEffect, useState } from "react";
import { getMembers, type ProjectMember } from "@/lib/projectMembersApi";

// Displays the users currently belonging to a project.
//
// A project membership is represented by the ProjectMember join table:
// one row = one User belonging to one Project.
//
// This section is responsible for:
// - fetching and displaying the project's current members
// - showing basic member information (avatar initials + username)
// - allowing ADMIN users to remove members
//
// API interactions are handled through projectMembersApi.ts:
interface MembersSectionProps {
  projectId: string;
}

export function MembersSection({ projectId }: MembersSectionProps) {
  const [members, setMembers] = useState<ProjectMember[]>([]);

  useEffect(() => {
    async function loadMembers() {
      try {
        const data = await getMembers(projectId);
        setMembers(data);
      } catch (error) {
        console.error(error);
        const raw = await fetch(`/api/projects/${projectId}/members`, {
          credentials: "include",
        }).then((r) => r.json());
        console.log("Raw project members:", raw);
      }
    }
    loadMembers();
  }, [projectId]);
  return (
    <SettingsSection
      title="Members"
      description="Add or remove people from this project."
    >
      <div className="space-y-4">
        {members.map((member) => (
          <MemberListItem
            key={member.id}
            username={member.user.username}
            avatarUrl={member.user.avatarUrl}
          />
        ))}

        {/* Add member form will go here */}
      </div>
    </SettingsSection>
  );
}

// GET /api/projects/:projectId/members
//      => retrieves all members of the project
//      => any project member can view the member list
//
// DELETE /api/projects/:projectId/members/:userId
//      => removes a user from the project
//      => only ADMIN members are allowed to perform this action
//
// Permissions:
// - All project members can view this section.
// - Only ADMIN users should see the remove controls.
// - The frontend permission check is only for user experience.
// - The backend always validates permissions to prevent unauthorized API calls.
//
// Member management rules:
// - A member cannot remove themselves unless the backend allows it.
// - Removing the last ADMIN should be prevented by backend validation
//   if that rule exists in the project requirements.
//
// UI responsibilities:
// - Render each member with avatar initials and username.
// - Provide accessible labels for icon-only remove buttons.
// - Update the member list after successful mutations.
