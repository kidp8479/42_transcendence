// MembersSection.tsx

import { SettingsSection } from "./SettingsSection";
import { MemberListItem } from "./MemberListItem";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  getMembers,
  addMember,
  removeMember,
  updateMemberRole,
  type ProjectMember,
} from "@/lib/projectMembersApi";
import { Button } from "flowbite-react";
import { FaUserPlus } from "react-icons/fa";
import { useToast } from "@/hooks/useToast";
import { getSession } from "@/lib/auth";
import { RemoveMemberModal } from "./RemoveMemberModal";
import { getRealtimeSocket } from "@/lib/realtimeSocket";

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
  const [username, setUsername] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<ProjectMember | null>(
    null
  );
  const { showToast } = useToast();

  const loadMembers = useCallback(async () => {
    try {
      const session = await getSession();
      setCurrentUserId(session?.user.id ?? null);

      const data = await getMembers(projectId);
      setMembers(data);
    } catch {
      showToast({
        message: "Failed to load members",
        type: "error",
      });
    }
  }, [projectId, showToast]);
  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  // listen for realtime member role updates
  useEffect(() => {
    const socket = getRealtimeSocket();

    socket.on(
      "project:member-role-changed",
      (data: { userId: string; role: "OWNER" | "ADMIN" | "MEMBER" }) => {
        setMembers((currentMembers) =>
          currentMembers.map((member) =>
            member.userId === data.userId
              ? {
                  ...member,
                  role: data.role,
                }
              : member
          )
        );
      }
    );
    return () => {
      socket.off("project:member-role-changed");
    };
  }, [projectId]);

  const currentUserRole = members.find(
    (member) => member.userId === currentUserId
  )?.role;

  const canAddMembers =
    currentUserRole === "OWNER" || currentUserRole === "ADMIN";

  const handleRoleChange = async (userId: string, role: "ADMIN" | "MEMBER") => {
    try {
      await updateMemberRole(projectId, userId, role);

      showToast({
        message: "Member role updated",
        type: "success",
      });
    } catch {
      showToast({
        message: "Failed to update member role",
        type: "error",
      });
    }
  };

  const handleConfirmRemove = async () => {
    if (!memberToRemove) {
      return;
    }

    try {
      await removeMember(projectId, memberToRemove.userId);
      await loadMembers();
      showToast({
        message: "Member removed",
        type: "success",
      });
      setMemberToRemove(null);
    } catch {
      showToast({
        message: "Failed to remove member",
        type: "error",
      });
    }
  };

  async function handleAddMember(event: FormEvent) {
    event.preventDefault();
    try {
      await addMember(projectId, {
        username,
      });
      showToast({
        message: "Member added",
        type: "success",
      });

      await loadMembers();
      setUsername("");
    } catch (error) {
      showToast({
        message:
          error instanceof Error ? error.message : "Failed to add member",
        type: "error",
      });
    }
  }

  function handleRemoveClick(member: ProjectMember) {
    setMemberToRemove(member);
  }

  function handleCloseRemoveModal() {
    setMemberToRemove(null);
  }

  return (
    <>
      <SettingsSection
        title="Members"
        description="Add or remove people from this project."
      >
        <div className="space-y-1.5">
          {members.map((member) => (
            <MemberListItem
              key={member.id}
              userId={member.userId}
              username={member.user.username}
              role={member.role}
              currentUserRole={currentUserRole}
              onRoleChange={handleRoleChange}
              avatarUrl={member.user.avatarUrl}
              onRemove={() => handleRemoveClick(member)}
            />
          ))}
          {canAddMembers && (
            <form onSubmit={handleAddMember}>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Add member by username"
                  className="h-9 flex-1 rounded-md bg-surface-overlay px-3 text-sm text-text-primary placeholder:text-text-secondary"
                />

                <Button
                  type="submit"
                  color="none"
                  className="!h-9 !rounded-lg !bg-brand-500 !text-black hover:!bg-brand-600 inline-flex items-center gap-2"
                  disabled={!username.trim()}
                >
                  <FaUserPlus className="h-4 w-4" />
                  Add
                </Button>
              </div>
            </form>
          )}
        </div>
      </SettingsSection>
      <RemoveMemberModal
        member={memberToRemove}
        onClose={handleCloseRemoveModal}
        onConfirm={handleConfirmRemove}
      />
    </>
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
