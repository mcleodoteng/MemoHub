import {
  ConversationRepository,
  CreateConversationData,
  UpdateConversationData,
} from "../repositories/conversation.repository.js";
import { prisma } from "../config/prisma.js";

export class ConversationService {
  private conversationRepository: ConversationRepository;

  constructor() {
    this.conversationRepository = new ConversationRepository();
  }

  async getConversations(userId: string, page = 1, limit = 20) {
    return this.conversationRepository.getUserConversations(
      userId,
      page,
      limit,
    );
  }

  async getConversationById(id: string) {
    const conversation = await this.conversationRepository.findById(id);

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    return conversation;
  }

  async createConversation(data: CreateConversationData) {
    // Validate that all participants exist
    if (data.participantIds?.length) {
      const participants = await prisma.user.findMany({
        where: { id: { in: data.participantIds } },
        select: { id: true },
      });

      if (participants.length !== data.participantIds.length) {
        throw new Error("One or more participants not found");
      }
    }

    return this.conversationRepository.create(data);
  }

  async updateConversation(id: string, data: UpdateConversationData) {
    const existingConversation = await this.conversationRepository.findById(id);

    if (!existingConversation) {
      throw new Error("Conversation not found");
    }

    return this.conversationRepository.update(id, data);
  }

  async deleteConversation(id: string, userId: string) {
    const conversation = await this.conversationRepository.findById(id);

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // Check if user is a participant
    const participantIds = (conversation.participantIds as string[]) || [];
    if (!participantIds.includes(userId)) {
      throw new Error("Access denied");
    }

    return this.conversationRepository.delete(id);
  }

  async addParticipant(
    conversationId: string,
    userId: string,
    adderId: string,
  ) {
    const conversation =
      await this.conversationRepository.findById(conversationId);

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // Check if adder is a participant
    const participantIds = (conversation.participantIds as string[]) || [];
    if (!participantIds.includes(adderId)) {
      throw new Error("Access denied");
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Check if user is already a participant
    if (participantIds.includes(userId)) {
      throw new Error("User is already a participant");
    }

    const updatedParticipantIds = [...participantIds, userId];

    return this.conversationRepository.update(conversationId, {
      participantIds: updatedParticipantIds as any,
    });
  }

  async removeParticipant(
    conversationId: string,
    userId: string,
    removerId: string,
  ) {
    const conversation =
      await this.conversationRepository.findById(conversationId);

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // Check if remover is a participant
    const participantIds = (conversation.participantIds as string[]) || [];
    if (!participantIds.includes(removerId)) {
      throw new Error("Access denied");
    }

    // Check if user is a participant
    if (!participantIds.includes(userId)) {
      throw new Error("User is not a participant");
    }

    // Don't allow removing the last participant
    if (participantIds.length <= 1) {
      throw new Error("Cannot remove the last participant");
    }

    const updatedParticipantIds = participantIds.filter((id) => id !== userId);

    return this.conversationRepository.update(conversationId, {
      participantIds: updatedParticipantIds as any,
    });
  }

  async getConversationParticipants(conversationId: string) {
    const conversation =
      await this.conversationRepository.findById(conversationId);

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const participantIds = (conversation.participantIds as string[]) || [];
    const participants = await prisma.user.findMany({
      where: { id: { in: participantIds } },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        department: true,
        status: true,
        lastLoginAt: true,
      },
    });

    return participants;
  }
}
