// MembersSection.tsx

import { SettingsSection } from "./SettingsSection";
import { SettingsActionRow } from "./SettingsActionRow";
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
import { HiOutlineArrowRightOnRectangle } from "react-icons/hi2";
import { useToast } from "@/hooks/useToast";
import { getSession } from "@/lib/auth";
import { RemoveMemberModal } from "./RemoveMemberModal";
import { LeaveProjectModal } from "./LeaveProjectModal";
import { getRealtimeSocket } from "@/lib/realtimeSocket";
import { useSafeRouterInvalidate } from "@/hooks/useSafeRouterInvalidate";

// Displays the users currently belonging to a project (the ProjectMember
// join table: one row = one User in one Project). GET
// /api/projects/:projectId/members - any project member can view. The
// frontend permission checks below are for UX only; the backend always
// re-validates every mutation.
// TODO: consider preventing removal of the last remaining ADMIN, if that
// becomes a real product requirement (not currently enforced anywhere).
interface MembersSectionProps {
  projectId: string;
  onLeaveProjectSuccess?: () => void;
}

export function MembersSection({
  projectId,
  onLeaveProjectSuccess,
}: MembersSectionProps) {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [username, setUsername] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<ProjectMember | null>(
    null
  );
  const [isRemoving, setIsRemoving] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isSubmittingMember, setIsSubmittingMember] = useState(false);
  const { showToast } = useToast();
  const safeInvalidateRouter = useSafeRouterInvalidate();

  const loadMembers = useCallback(async () => {
    try {
      // independent of each other, so they run in parallel (Promise.all) -
      // same pattern as discovery.tsx's own independent fetches
      const [session, data] = await Promise.all([
        getSession(),
        getMembers(projectId),
      ]);
      setCurrentUserId(session?.user.id ?? null);
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

    const handleMemberRoleChanged = (data: {
      userId: string;
      projectId: string;
      role: "OWNER" | "ADMIN" | "MEMBER";
    }) => {
      if (data.projectId !== projectId) {
        return;
      }
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
    };

    const handleMemberRemoved = (data: {
      userId: string;
      projectId: string;
    }) => {
      if (data.projectId !== projectId) {
        return;
      }
      setMembers((currentMembers) =>
        currentMembers.filter((member) => member.userId !== data.userId)
      );
    };

    // Every socket joins ALL of a user's project:<id> rooms at connect time
    // (see realtimeService.joinProjectRoom), not just the one currently open
    // in this tab - an add/remove in a DIFFERENT project this user also
    // belongs to still reaches this listener. Without the projectId check,
    // that event would corrupt this project's member list with another
    // project's member, or drop one of this project's members by a
    // coincidentally-matching userId.
    const handleMemberAdded = (member: ProjectMember) => {
      if (member.projectId !== projectId) {
        return;
      }
      setMembers((currentMembers) =>
        currentMembers.some((existing) => existing.id === member.id)
          ? currentMembers
          : [...currentMembers, member]
      );
    };

    // Named handlers + socket.off(event, handler) below, not socket.off(event):
    // getRealtimeSocket() is a shared singleton - AuthenticatedLayout also
    // listens for "project:member-added"/"project:member-removed" on this
    // same socket for cross-user sidebar sync. socket.off(event) with no
    // handler removes EVERY listener for that event, not just this
    // component's, which was silently breaking AuthenticatedLayout's sync
    // the moment this component unmounted.
    socket.on("project:member-role-changed", handleMemberRoleChanged);
    socket.on("project:member-removed", handleMemberRemoved);
    socket.on("project:member-added", handleMemberAdded);

    return () => {
      socket.off("project:member-role-changed", handleMemberRoleChanged);
      socket.off("project:member-removed", handleMemberRemoved);
      socket.off("project:member-added", handleMemberAdded);
    };
  }, [projectId]);

  const currentUserRole = members.find(
    (member) => member.userId === currentUserId
  )?.role;

  const canAddMembers =
    currentUserRole === "OWNER" || currentUserRole === "ADMIN";
  // Anyone but OWNER can leave (backend requires exactly one OWNER per
  // project, so they'd need to delete/transfer it instead - see
  // DangerZoneSection.tsx). Requires currentUserRole to already be resolved,
  // so it doesn't flash true before loadMembers() finishes.
  const canLeave = currentUserRole !== undefined && currentUserRole !== "OWNER";

  // PATCH /api/projects/:projectId/members/:userId - changes a member's role.
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

  // DELETE /api/projects/:projectId/members/:userId - removes memberToRemove.
  const handleConfirmRemove = async () => {
    if (!memberToRemove || isRemoving) {
      return;
    }

    setIsRemoving(true);
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
    } finally {
      setIsRemoving(false);
    }
  };

  // POST /api/projects/:projectId/members - adds a member by username.
  // TODO: (v1) two gaps in add-member worth addressing together:
  // 1. Requires knowing and typing the exact username - no search/
  //    autocomplete, so a typo isn't caught until after clicking Add
  //    (backend correctly returns "User not found", but only then). Worth
  //    a typeahead search endpoint (GET /users/search?q=...) with a
  //    picker UI, or at minimum a debounced inline lookup that confirms a
  //    match before submit.
  // 2. Bigger gap: addMember grants access immediately and unilaterally -
  //    the target user has no chance to accept or decline before they're
  //    already a member. Should become a real invite flow (a pending
  //    request the target must accept) instead of an unconditional add,
  //    which also gives search/autocomplete (1) a natural home: inviting
  //    someone found via search, rather than blindly adding them.
  async function handleAddMember(event: FormEvent) {
    event.preventDefault();
    if (isSubmittingMember) {
      return;
    }
    setIsSubmittingMember(true);
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
    } finally {
      setIsSubmittingMember(false);
    }
  }

  // DELETE /api/projects/:projectId/members/:userId - removes yourself,
  // except OWNER.
  async function handleLeaveProject() {
    if (!currentUserId) {
      showToast({
        type: "error",
        message: "Still loading your session, please try again",
      });
      return;
    }
    setIsLeaving(true);
    try {
      await removeMember(projectId, currentUserId);
    } catch {
      showToast({
        message: "Failed to leave project",
        type: "error",
      });
      setIsLeaving(false);
      return;
    }
    showToast({
      message: "You left the project.",
      type: "success",
    });
    // Navigating away right after this unmounts the component before the
    // "project:member-removed" websocket round-trip reliably invalidates the
    // sidebar's data for us - invalidate directly so it's already fresh.
    await safeInvalidateRouter();
    onLeaveProjectSuccess?.();
  }

  function handleRemoveClick(member: ProjectMember) {
    setMemberToRemove(member);
  }

  function handleCloseRemoveModal() {
    setMemberToRemove(null);
  }

  function handleCloseLeaveModal() {
    setShowLeaveModal(false);
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
                  aria-label="Username to add"
                  className="h-9 flex-1 rounded-md bg-surface-overlay px-3 text-sm text-text-primary placeholder:text-text-secondary"
                />

                <Button
                  type="submit"
                  color="none"
                  className="!h-9 !rounded-lg !bg-brand-500 !text-black hover:!bg-brand-600 inline-flex items-center gap-2"
                  disabled={!username.trim() || isSubmittingMember}
                >
                  <FaUserPlus className="h-4 w-4" />
                  {isSubmittingMember ? "Adding..." : "Add"}
                </Button>
              </div>
            </form>
          )}
        </div>
        {canLeave && (
          <div className="mt-4 border-t border-surface-border pt-4">
            <SettingsActionRow
              title="Leave this project"
              description="You will no longer have access to this project once you leave."
              icon={<HiOutlineArrowRightOnRectangle className="h-5 w-5" />}
            >
              <Button
                type="button"
                color="none"
                onClick={() => setShowLeaveModal(true)}
                className="!h-9 !rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 inline-flex items-center gap-2"
              >
                <HiOutlineArrowRightOnRectangle className="h-4 w-4" />
                Leave project
              </Button>
            </SettingsActionRow>
          </div>
        )}
      </SettingsSection>
      <RemoveMemberModal
        member={memberToRemove}
        isRemoving={isRemoving}
        onClose={handleCloseRemoveModal}
        onConfirm={handleConfirmRemove}
      />
      <LeaveProjectModal
        show={showLeaveModal}
        isLeaving={isLeaving}
        onClose={handleCloseLeaveModal}
        onConfirm={handleLeaveProject}
      />
    </>
  );
}
