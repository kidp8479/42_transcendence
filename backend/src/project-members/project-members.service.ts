// ProjectMembersService: handles all database operations for ProjectMembers
// called by the controller, never called directly by the frontend
// ProjectMember is a join table: each row = one user belonging to one project (many-to-many relation)

import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectsService } from "../projects/projects.service";
import { AddMemberDto } from "./dto/add-member.dto";
import { NotificationsService } from "../notifications/notifications.service";
import { RealtimeService } from "../realtime/realtime.service";

@Injectable()
export class ProjectMembersService {
  // all methods below will use PrismaService to query the database
  // none of these are called directly by the frontend - always via the controller
  // inject PrismaService here via constructor
  // inject ProjectsService here via constructor (for assertMembership below)
  // the constructor is called automatically by NestJS at startup - never called manually
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
    private readonly notificationsService: NotificationsService,
    private readonly realtimeService: RealtimeService
  ) {}

  // NOTE ON ROLES: adding/removing a member changes who's on the team, so unlike most other
  // modules, these two DO need an OWNER/ADMIN check on top of assertMembership - decided with the
  // team (see TR-66) that role checks only matter for Project + ProjectMember management,
  // not everyday content (tasks, discovery blocks, etc.)

  // Shared by removeMember and updateMemberRole: an ADMIN can act on a
  // MEMBER, but only the OWNER can act on a fellow ADMIN (TR-80's
  // cross-branch review - without this, any two admins could remove or
  // demote each other). Each call site is responsible for its own
  // exemptions (ex: removeMember's self-removal, updateMemberRole's no-op
  // role check) before calling this.
  private assertOwnerRequiredForAdminTarget(
    targetRole: "OWNER" | "ADMIN" | "MEMBER",
    requesterRole: "OWNER" | "ADMIN" | "MEMBER",
    action: string
  ): void {
    if (targetRole === "ADMIN" && requesterRole !== "OWNER") {
      throw new ForbiddenException(`Only the project owner can ${action}`);
    }
  }

  // must also throw (ex: ForbiddenException) if requester.role is neither "OWNER" nor "ADMIN"
  // insert a new row in the ProjectMember table (link a user to a project)
  // wrapped in withProjectLock, same as removeMember/updateMemberRole -
  // without it, a requester whose role is being changed/removed by a
  // concurrent, lock-protected call could still pass this permission check
  // on their stale pre-change role, since nothing would serialize the two.
  async addMember(
    projectId: string,
    dto: AddMemberDto,
    requestingUserId: string
  ) {
    return this.realtimeService.withProjectLock(projectId, async () => {
      // verify requester belongs to the project
      const requester = await this.projectsService.assertMembership(
        projectId,
        requestingUserId
      );
      // verify they're owner or admin
      if (requester.role !== "OWNER" && requester.role !== "ADMIN") {
        throw new ForbiddenException(
          "Only project owner or admins can add members"
        );
      }
      // find user by username
      const user = await this.prisma.user.findUnique({
        where: {
          username: dto.username,
        },
      });
      if (!user) {
        throw new NotFoundException("User not found");
      }
      // prevent adding the same user twice
      const existingMember = await this.prisma.projectMember.findUnique({
        where: {
          userId_projectId: {
            userId: user.id,
            projectId,
          },
        },
      });
      if (existingMember) {
        throw new BadRequestException(
          "User is already a member of this project"
        );
      }
      // create a ProjectMember row
      const member = await this.prisma.projectMember.create({
        data: {
          projectId,
          userId: user.id,
          role: "MEMBER",
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              campus: true,
            },
          },
        },
      });

      const project = await this.prisma.project.findUniqueOrThrow({
        where: { id: projectId },
        select: { name: true },
      });
      await this.notificationsService.create(
        user.id,
        `You were added to "${project.name}"`,
        `/${projectId}/project-settings`
      );
      this.realtimeService.joinProjectRoom(user.id, projectId);

      this.realtimeService.emitToProject(
        projectId,
        "project:member-added",
        member
      );

      return member;
    });
  }

  // no role check, any member can see the member list
  // fetch all members belonging to a given project
  async findAll(projectId: string, requestingUserId: string) {
    await this.projectsService.assertMembership(projectId, requestingUserId);
    return this.prisma.projectMember.findMany({
      where: {
        projectId,
      },
      orderBy: {
        createdAt: "asc",
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            campus: true,
          },
        },
      },
    });
  }

  // same requester + role check as addMember (const requester = ...; if (requester.role is neither "OWNER" nor "ADMIN") throw ...)
  // delete the ProjectMember row that links this user to this project.
  // A user removing themselves ("leave project") is always allowed regardless
  // of their own role - only removing someone ELSE requires OWNER/ADMIN.
  async removeMember(
    projectId: string,
    userId: string,
    requestingUserId: string
  ) {
    return this.realtimeService.withProjectLock(projectId, async () => {
      // verify requester belongs to project
      const requester = await this.projectsService.assertMembership(
        projectId,
        requestingUserId
      );
      const isSelfRemoval = requestingUserId === userId;
      // only OWNER or ADMIN can remove someone else
      if (
        !isSelfRemoval &&
        requester.role !== "OWNER" &&
        requester.role !== "ADMIN"
      ) {
        throw new ForbiddenException(
          "Only the project owner or admin can remove members"
        );
      }
      // verify target exists in project - self-removal already resolved this
      // row as `requester` above, no need to fetch it again
      const memberToRemove = isSelfRemoval
        ? requester
        : await this.projectsService.assertMembership(projectId, userId);
      // prevent removing the OWNER - every project has exactly one, enforced in
      // DB (TR-69). Also blocks an owner from "leaving" through this endpoint.
      if (memberToRemove.role === "OWNER") {
        throw new ForbiddenException("Cannot remove the project owner");
      }
      // doesn't apply when an admin is removing themselves
      if (!isSelfRemoval) {
        this.assertOwnerRequiredForAdminTarget(
          memberToRemove.role,
          requester.role,
          "remove an admin"
        );
      }
      // KNOWN GAP (TR-B): this deletes the membership row and nothing else.
      // TaskAssignee/CalendarAssignee only cascade on User deletion, not on a
      // member leaving a project, so their rows survive and keep pointing at a
      // non-member. TasksService.assertAssigneesAreProjectMembers then rejects
      // any PATCH that resends that id, which made the affected task impossible
      // to save from the Kanban drawer at all - worked around client-side in
      // TR-49 (KanbanCardDrawer filters stale ids out of its draft), still to be
      // fixed here, inside this same transaction.
      const removed = await this.prisma.projectMember.delete({
        where: {
          userId_projectId: {
            userId,
            projectId,
          },
        },
      });
      // Tells the rest of the team, plus the kicked user themselves (not on
      // a self-removal - no need to tell someone they left when they're the
      // one who just did it). Runs after the delete, so this query of
      // remaining ProjectMember rows already excludes the removed user for
      // free - requestingUserId is excluded too, since the actor doesn't
      // need to be told about their own action.
      const [project, removedUser, remainingMembers] = await Promise.all([
        this.prisma.project.findUniqueOrThrow({
          where: { id: projectId },
          select: { name: true },
        }),
        this.prisma.user.findUniqueOrThrow({
          where: { id: userId },
          select: { username: true },
        }),
        this.prisma.projectMember.findMany({
          where: { projectId, userId: { not: requestingUserId } },
          select: { userId: true },
        }),
      ]);
      const removalMessage = isSelfRemoval
        ? `${removedUser.username} left "${project.name}"`
        : `${removedUser.username} was removed from "${project.name}"`;
      await Promise.all(
        remainingMembers.map((member) =>
          this.notificationsService.create(
            member.userId,
            removalMessage,
            `/${projectId}/project-settings`
          )
        )
      );
      if (!isSelfRemoval) {
        // No link, unlike the notification above - the kicked user no
        // longer has access to /:projectId/project-settings.
        await this.notificationsService.create(
          userId,
          `You were removed from "${project.name}"`
        );
      }
      this.realtimeService.emitToProject(projectId, "project:member-removed", {
        userId,
        projectId,
      });
      this.realtimeService.leaveProjectRoom(userId, projectId);
      for (const released of this.realtimeService.releaseFieldLocksForUserInProject(
        userId,
        projectId
      )) {
        this.realtimeService.emitFieldUnlock(released);
      }
      return removed;
    });
  }

  // wrapped in withProjectLock, same as removeMember - without it, two
  // concurrent role-change requests (ex: an OWNER demoting this requester
  // while this requester's own promote of someone else is still in flight)
  // could both pass their permission check before either write commits.
  async updateMemberRole(
    projectId: string,
    userId: string,
    newRole: "ADMIN" | "MEMBER",
    requestingUserId: string
  ) {
    return this.realtimeService.withProjectLock(projectId, async () => {
      // verify requester belongs to project
      const requester = await this.projectsService.assertMembership(
        projectId,
        requestingUserId
      );
      // only OWNER and ADMIN can change roles
      if (requester.role !== "OWNER" && requester.role !== "ADMIN") {
        throw new ForbiddenException(
          "Only the project owner and admin can change member roles"
        );
      }
      // verify target exists in project
      const memberToUpdate = await this.projectsService.assertMembership(
        projectId,
        userId
      );
      // cannot change OWNER role
      if (memberToUpdate.role === "OWNER") {
        throw new ForbiddenException("Cannot change the project owner's role");
      }

      if (newRole === "MEMBER") {
        this.assertOwnerRequiredForAdminTarget(
          memberToUpdate.role,
          requester.role,
          "demote admins"
        );
      }

      if (memberToUpdate.role === newRole) {
        throw new BadRequestException("Member already has this role");
      }

      // update role
      const updateMember = await this.prisma.projectMember.update({
        where: {
          userId_projectId: {
            userId,
            projectId,
          },
        },
        data: {
          role: newRole,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              campus: true,
            },
          },
        },
      });
      // Tells the rest of the team, plus the promoted/demoted member
      // themselves - not the requester, who already knows what they just
      // did.
      const [project, otherMembers] = await Promise.all([
        this.prisma.project.findUniqueOrThrow({
          where: { id: projectId },
          select: { name: true },
        }),
        this.prisma.projectMember.findMany({
          where: { projectId, userId: { notIn: [userId, requestingUserId] } },
          select: { userId: true },
        }),
      ]);
      const roleChangeAction =
        newRole === "ADMIN" ? "promoted to ADMIN" : "demoted to MEMBER";
      await Promise.all([
        ...otherMembers.map((member) =>
          this.notificationsService.create(
            member.userId,
            `${updateMember.user.username} was ${roleChangeAction} in "${project.name}"`,
            `/${projectId}/project-settings`
          )
        ),
        this.notificationsService.create(
          userId,
          `You were ${roleChangeAction} in "${project.name}"`,
          `/${projectId}/project-settings`
        ),
      ]);
      this.realtimeService.emitToProject(
        projectId,
        "project:member-role-changed",
        {
          userId,
          projectId,
          role: newRole,
        }
      );
      return updateMember;
    });
  }
}
