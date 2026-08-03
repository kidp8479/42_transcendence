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

// Displays the users currently belonging to a project (the ProjectMember
// join table: one row = one User in one Project). GET
// /api/projects/:projectId/members - any project member can view. The
// frontend permission checks below are for UX only; the backend always
// re-validates every mutation.
// TODO: consider preventing removal of the last remaining ADMIN, if that
// becomes a real product requirement (not currently enforced anywhere).
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

    socket.on("project:member-removed", (data: { userId: string }) => {
      setMembers((currentMembers) =>
        currentMembers.filter((member) => member.userId !== data.userId)
      );
    });

    socket.on("project:member-added", (member: ProjectMember) => {
      setMembers((currentMembers) => [...currentMembers, member]);
    });

    return () => {
      socket.off("project:member-role-changed");
      socket.off("project:member-removed");
      socket.off("project:member-added");
    };
  }, [projectId]);

  const currentUserRole = members.find(
    (member) => member.userId === currentUserId
  )?.role;

  const canAddMembers =
    currentUserRole === "OWNER" || currentUserRole === "ADMIN";

  // PATCH /api/projects/:projectId/members/:userId (projectMembersApi.ts) -
  // OWNER or ADMIN can promote a MEMBER to ADMIN; only OWNER can demote an
  // ADMIN back to MEMBER (both enforced backend-side too).
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

  // DELETE /api/projects/:projectId/members/:userId (projectMembersApi.ts) -
  // OWNER/ADMIN can remove someone else. The backend also allows removing
  // yourself regardless of role ("leave"), but that path isn't exposed here.
  // TODO: add a self-service "leave project" action to this component too -
  // currently only reachable via the cogwheel menu on the Projects grid
  // (ProjectCard.tsx).
  const handleConfirmRemove = async () => {
    if (!memberToRemove) {
      return;
    }

    try {
      await removeMember(projectId, memberToRemove.userId);
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

  // POST /api/projects/:projectId/members (projectMembersApi.ts) - only
  // OWNER/ADMIN can add members; body is { username }, resolved server-side.
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
