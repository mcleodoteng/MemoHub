import {
  GroupRepository,
  GroupFilters,
} from "../repositories/group.repository.js";
import { NotificationService } from "./notification.service.js";
import {
  CreateGroupInput,
  UpdateGroupInput,
} from "../validators/group.validator.js";
import { ConversationRepository } from "../repositories/conversation.repository.js";
import { MessageRepository } from "../repositories/message.repository.js";
import { prisma } from "../config/prisma.js";
import { io } from "../server.js";
import { emitReportsDataUpdated } from "../sockets/reports.socket.js";

export class GroupService {
  private groupRepository: GroupRepository;
  private notificationService: NotificationService;
  private conversationRepository: ConversationRepository;
  private messageRepository: MessageRepository;

  constructor() {
    this.groupRepository = new GroupRepository();
    this.notificationService = new NotificationService();
    this.conversationRepository = new ConversationRepository();
    this.messageRepository = new MessageRepository();
  }

  private async getDisplayName(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

    return user?.name || user?.email || "A user";
  }

  private async getOrCreateGroupConversation(groupId: string) {
    const group = await this.groupRepository.findById(groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    const participantIds = group.members.map((member) => member.userId);
    return this.conversationRepository.getOrCreateGroupConversation(
      group.id,
      participantIds,
      group.name,
    );
  }

  private async postGroupSystemMessage(
    groupId: string,
    body: string,
    actorUserId?: string,
  ) {
    const conversation = await this.getOrCreateGroupConversation(groupId);
    const participants = (conversation.participantIds as string[]) || [];

    let senderId = actorUserId;
    if (!senderId || !participants.includes(senderId)) {
      senderId = participants[0];
    }

    if (!senderId) {
      return;
    }

    const message = await this.messageRepository.create({
      conversationId: conversation.id,
      senderId,
      body,
      isSystem: true,
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    // Broadcast system message in real-time to anyone viewing the conversation
    io.to(`conversation_${conversation.id}`).emit("new_message", {
      message,
      conversationId: conversation.id,
    });
  }

  private async notifyAllGroupMembers(
    groupId: string,
    title: string,
    body: string,
    actionUrl?: string,
  ) {
    const group = await this.groupRepository.findById(groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    const memberIds = Array.from(new Set(group.members.map((m) => m.userId)));

    await Promise.all(
      memberIds.map((memberId) =>
        this.notificationService.createNotification({
          userId: memberId,
          type: "group_activity",
          title,
          body,
          actionUrl: actionUrl || `/groups/${groupId}`,
        }),
      ),
    );
  }

  async getGroups(filters: GroupFilters = {}, page = 1, limit = 20) {
    return this.groupRepository.findAll(filters, page, limit);
  }

  async getGroupById(id: string) {
    return this.groupRepository.findById(id);
  }

  async createGroup(data: CreateGroupInput, creatorId: string) {
    // Create the group
    const group = await this.groupRepository.create({
      name: data.name,
      description: data.description,
      type: data.type,
      avatar: data.avatar,
    });

    // Add creator as admin member
    await this.groupRepository.addMember(group.id, creatorId, "admin");

    // Add other members if provided
    if (data.memberIds && data.memberIds.length > 0) {
      for (const memberId of data.memberIds) {
        if (memberId !== creatorId) {
          await this.groupRepository.addMember(group.id, memberId, "member");
        }
      }
    }

    return this.groupRepository.findById(group.id);
  }

  async updateGroup(id: string, data: UpdateGroupInput) {
    return this.groupRepository.update(id, data);
  }

  async deleteGroup(id: string) {
    return this.groupRepository.delete(id);
  }

  async addMember(groupId: string, userId: string, role = "member") {
    // Check if already a member
    const existing = await this.groupRepository.getMember(groupId, userId);
    if (existing) {
      throw new Error("User is already a member of this group");
    }

    const member = await this.groupRepository.addMember(groupId, userId, role);

    const groupConversation =
      await this.conversationRepository.findByGroupId(groupId);
    if (groupConversation) {
      try {
        await this.conversationRepository.addParticipant(
          groupConversation.id,
          userId,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (message !== "User is already a participant") {
          throw error;
        }
      }
    }

    const addedName = await this.getDisplayName(userId);
    const addedGroup = await this.groupRepository.findById(groupId);
    const addedGroupName = addedGroup?.name ?? "the group";

    await Promise.allSettled([
      this.postGroupSystemMessage(
        groupId,
        `${addedName} was added to the group`,
        userId,
      ),
      this.notifyAllGroupMembers(
        groupId,
        `New member in ${addedGroupName}`,
        `${addedName} was added to ${addedGroupName}`,
      ),
    ]);

    // Notify all group members to refresh their group lists
    io.to(`group_${groupId}`).emit("group:member_updated", { groupId });
    emitReportsDataUpdated("group_member_added", { groupId, userId });
    // Tell the added user to reload their conversations
    io.to(`user_${userId}`).emit("conversations:refresh");

    return member;
  }

  async removeMember(
    groupId: string,
    userId: string,
    requestingUserId: string,
  ) {
    // Get group to check permissions
    const group = await this.groupRepository.findById(groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    // Check if requesting user is admin
    const requestingMember = group.members.find(
      (m) => m.userId === requestingUserId,
    );
    if (requestingMember?.role !== "admin") {
      throw new Error("Only group admins can remove members");
    }

    const removedName = await this.getDisplayName(userId);
    const removerName = await this.getDisplayName(requestingUserId);
    const groupName = group.name ?? "the group";

    const removed = await this.groupRepository.removeMember(groupId, userId);

    await Promise.allSettled([
      this.postGroupSystemMessage(
        groupId,
        `${removerName} removed ${removedName} from the group`,
        requestingUserId,
      ),
      this.notifyAllGroupMembers(
        groupId,
        `Member removed from ${groupName}`,
        `${removerName} removed ${removedName} from ${groupName}`,
      ),
    ]);

    // Notify all group members to refresh their group lists
    io.to(`group_${groupId}`).emit("group:member_updated", { groupId });
    emitReportsDataUpdated("group_member_removed", { groupId, userId });

    const groupConversation =
      await this.conversationRepository.findByGroupId(groupId);
    if (groupConversation) {
      try {
        await this.conversationRepository.removeParticipant(
          groupConversation.id,
          userId,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (
          message !== "User is not a participant" &&
          message !== "Cannot remove the last participant"
        ) {
          throw error;
        }
      }
    }

    return removed;
  }

  /**
   * Called when a user account is deleted by an admin.
   * Removes the user from the group, notifies all remaining members,
   * and posts a system message — without requiring a requesting admin user.
   */
  async removeMemberOnUserDeletion(
    groupId: string,
    userId: string,
    deletedUserName: string,
    notifyUserIds: string[] = [],
  ) {
    const group = await this.groupRepository.findById(groupId);
    if (!group) return;

    const groupName = group.name ?? "the group";
    const displayName = deletedUserName || "A user";

    // Remove the membership record
    await this.groupRepository.removeMember(groupId, userId);

    // Notify all remaining members
    await Promise.allSettled([
      this.notifyAllGroupMembers(
        groupId,
        `Member removed from ${groupName}`,
        `${displayName}'s account was deleted and they have been removed from ${groupName}.`,
      ),
      this.postGroupSystemMessage(
        groupId,
        `${displayName} was removed from the group (account deleted).`,
      ),
    ]);

    // Emit real-time update so connected clients refresh their group lists
    io.to(`group_${groupId}`).emit("group:member_updated", { groupId });
    emitReportsDataUpdated("group_member_removed_on_user_deletion", {
      groupId,
      userId,
    });

    // Also emit to each remaining member's personal room so list views update
    // even if they are not currently joined to the group room.
    const refreshedGroup = await this.groupRepository.findById(groupId);
    const remainingMemberIds = Array.from(
      new Set((refreshedGroup?.members || []).map((m) => m.userId)),
    );
    remainingMemberIds.forEach((memberId) => {
      io.to(`user_${memberId}`).emit("group:member_updated", { groupId });
    });

    io.to(`user_${userId}`).emit("group:member_updated", { groupId });

    notifyUserIds.filter(Boolean).forEach((viewerId) => {
      io.to(`user_${viewerId}`).emit("group:member_updated", { groupId });
    });

    // Remove from the group's conversation if one exists
    const groupConversation =
      await this.conversationRepository.findByGroupId(groupId);
    if (groupConversation) {
      try {
        await this.conversationRepository.removeParticipant(
          groupConversation.id,
          userId,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (
          message !== "User is not a participant" &&
          message !== "Cannot remove the last participant"
        ) {
          console.error(
            "Failed to remove deleted user from conversation:",
            error,
          );
        }
      }
    }
  }

  async getMembers(groupId: string) {
    return this.groupRepository.getMembers(groupId);
  }

  async inviteMember(
    groupId: string,
    userId: string,
    requestingUserId: string,
    email?: string,
  ) {
    // Check if requesting user is admin
    const group = await this.groupRepository.findById(groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    const requestingMember = group.members.find(
      (m) => m.userId === requestingUserId,
    );
    if (requestingMember?.role !== "admin") {
      throw new Error("Only group admins can invite members");
    }

    // Check if already a member
    const existing = await this.groupRepository.getMember(groupId, userId);
    if (existing) {
      throw new Error("User is already a member of this group");
    }

    // Check if already invited
    const existingInvite = await this.groupRepository.getInvite(
      groupId,
      userId,
    );
    if (existingInvite && existingInvite.status === "pending") {
      throw new Error("User has already been invited to this group");
    }

    // Create invite
    const invite = await this.groupRepository.createInvite(groupId, userId);

    const inviterName = await this.getDisplayName(requestingUserId);
    const invitedName = await this.getDisplayName(userId);
    const inviteGroupName = group.name ?? "a group";

    await Promise.allSettled([
      this.postGroupSystemMessage(
        groupId,
        `${inviterName} invited ${invitedName} to the group`,
        requestingUserId,
      ),
      this.notifyAllGroupMembers(
        groupId,
        `New invite in ${inviteGroupName}`,
        `${inviterName} invited ${invitedName} to join ${inviteGroupName}`,
      ),
    ]);

    // Send personal invite notification to the invited user
    await this.notificationService.createNotification({
      userId: userId,
      type: "group_invite",
      title: `You're invited to join ${inviteGroupName}`,
      body: `${inviterName} invited you to join ${inviteGroupName}. Accept or decline the invitation.`,
      actionUrl: `/groups/${groupId}`,
    });

    // Notify the group and the invited user
    io.to(`group_${groupId}`).emit("group:member_updated", { groupId });
    emitReportsDataUpdated("group_invite_created", { groupId, userId });

    return invite;
  }

  async respondToInvite(
    groupId: string,
    userId: string,
    status: "accepted" | "declined",
  ) {
    const invite = await this.groupRepository.getInvite(groupId, userId);
    if (!invite) {
      throw new Error("Invite not found");
    }

    if (invite.status !== "pending") {
      throw new Error("Invite has already been responded to");
    }

    const actorName = await this.getDisplayName(userId);
    const result = await this.groupRepository.respondToInvite(
      groupId,
      userId,
      status,
    );

    const respondGroup = await this.groupRepository.findById(groupId);
    const respondGroupName = respondGroup?.name ?? "the group";

    if (status === "accepted") {
      const groupConversation =
        await this.conversationRepository.findByGroupId(groupId);
      if (groupConversation) {
        try {
          await this.conversationRepository.addParticipant(
            groupConversation.id,
            userId,
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "";
          if (message !== "User is already a participant") {
            throw error;
          }
        }
      }

      await Promise.allSettled([
        this.postGroupSystemMessage(
          groupId,
          `${actorName} joined the group`,
          userId,
        ),
        this.notifyAllGroupMembers(
          groupId,
          `New member in ${respondGroupName}`,
          `${actorName} just joined ${respondGroupName}`,
        ),
      ]);

      // Tell the accepted user to reload their conversations (they're now a participant)
      io.to(`user_${userId}`).emit("conversations:refresh");
    } else {
      await Promise.allSettled([
        this.postGroupSystemMessage(
          groupId,
          `${actorName} declined the invitation`,
        ),
        this.notifyAllGroupMembers(
          groupId,
          `Invite declined for ${respondGroupName}`,
          `${actorName} declined the invitation to join ${respondGroupName}`,
        ),
      ]);
    }

    // Notify all group members to refresh their group lists
    io.to(`group_${groupId}`).emit("group:member_updated", { groupId });
    emitReportsDataUpdated("group_invite_responded", { groupId, userId, status });

    return result;
  }

  async getPendingInvites(userId: string) {
    return this.groupRepository.getPendingInvites(userId);
  }

  async cancelInvite(
    groupId: string,
    invitedUserId: string,
    requestingUserId: string,
  ) {
    const group = await this.groupRepository.findById(groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    const requestingMember = group.members.find(
      (member) => member.userId === requestingUserId,
    );
    if (!requestingMember || requestingMember.role !== "admin") {
      throw new Error("Only group admins can cancel invitations");
    }

    const invite = await this.groupRepository.getInvite(groupId, invitedUserId);
    if (!invite || invite.status !== "pending") {
      throw new Error("Pending invite not found");
    }

    const cancelerName = await this.getDisplayName(requestingUserId);
    const invitedName = await this.getDisplayName(invitedUserId);
    const cancelGroupName = group.name ?? "the group";

    const result = await this.groupRepository.deleteInvite(
      groupId,
      invitedUserId,
    );
    if (result.count === 0) {
      throw new Error("Failed to cancel invite");
    }

    await Promise.allSettled([
      this.postGroupSystemMessage(
        groupId,
        `${cancelerName} canceled the invitation for ${invitedName}`,
        requestingUserId,
      ),
      this.notifyAllGroupMembers(
        groupId,
        `Invite canceled in ${cancelGroupName}`,
        `${cancelerName} canceled ${invitedName}'s invitation to join ${cancelGroupName}`,
      ),
    ]);

    // Notify all group members to refresh their group lists
    io.to(`group_${groupId}`).emit("group:member_updated", { groupId });
    emitReportsDataUpdated("group_invite_canceled", { groupId, userId: invitedUserId });

    return { groupId, userId: invitedUserId };
  }

  async leaveGroup(groupId: string, userId: string) {
    const group = await this.groupRepository.findById(groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    // Check if last admin
    const adminCount = group.members.filter((m) => m.role === "admin").length;
    const isLastAdmin =
      adminCount === 1 &&
      group.members.find((m) => m.userId === userId)?.role === "admin";

    if (isLastAdmin) {
      throw new Error(
        "Cannot leave group as the last admin. Transfer admin role first.",
      );
    }

    const leaverName = await this.getDisplayName(userId);
    const leaveGroupName = group.name ?? "the group";

    await Promise.allSettled([
      this.postGroupSystemMessage(
        groupId,
        `${leaverName} left the group`,
        userId,
      ),
      this.notifyAllGroupMembers(
        groupId,
        `Member left ${leaveGroupName}`,
        `${leaverName} has left ${leaveGroupName}`,
      ),
    ]);

    // Notify remaining group members to refresh their group lists
    io.to(`group_${groupId}`).emit("group:member_updated", { groupId });
    emitReportsDataUpdated("group_member_left", { groupId, userId });

    const left = await this.groupRepository.removeMember(groupId, userId);

    const groupConversation =
      await this.conversationRepository.findByGroupId(groupId);
    if (groupConversation) {
      try {
        await this.conversationRepository.removeParticipant(
          groupConversation.id,
          userId,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (
          message !== "User is not a participant" &&
          message !== "Cannot remove the last participant"
        ) {
          throw error;
        }
      }
    }

    return left;
  }
}
