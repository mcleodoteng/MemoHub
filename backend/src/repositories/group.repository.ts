import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface GroupFilters {
  type?: string;
  search?: string;
  memberUserId?: string;
}

export class GroupRepository {
  async findAll(filters: GroupFilters = {}, page = 1, limit = 20) {
    const where: any = {};

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    if (filters.memberUserId) {
      where.OR = [
        {
          members: {
            some: { userId: filters.memberUserId },
          },
        },
        {
          pendingInvites: {
            some: {
              userId: filters.memberUserId,
              status: "pending",
            },
          },
        },
      ];
    }

    const [groups, total] = await Promise.all([
      prisma.group.findMany({
        where,
        include: {
          members: {
            where: {
              user: {
                deletedAt: null,
              },
            },
            include: {
              user: {
                select: { id: true, email: true, name: true, avatar: true },
              },
            },
          },
          pendingInvites: true,
          conversations: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.group.count({ where }),
    ]);

    return {
      groups,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    return prisma.group.findUnique({
      where: { id },
      include: {
        members: {
          where: {
            user: {
              deletedAt: null,
            },
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                avatar: true,
                role: true,
              },
            },
          },
        },
        pendingInvites: true,
        conversations: true,
      },
    });
  }

  async create(data: {
    name: string;
    description?: string;
    type: string;
    avatar?: string;
  }) {
    return prisma.group.create({
      data,
      include: {
        members: true,
        pendingInvites: true,
        conversations: true,
      },
    });
  }

  async update(id: string, data: any) {
    return prisma.group.update({
      where: { id },
      data,
      include: {
        members: {
          where: {
            user: {
              deletedAt: null,
            },
          },
          include: {
            user: {
              select: { id: true, email: true, name: true, avatar: true },
            },
          },
        },
        pendingInvites: true,
        conversations: true,
      },
    });
  }

  async delete(id: string) {
    return prisma.group.delete({
      where: { id },
    });
  }

  async addMember(groupId: string, userId: string, role = "member") {
    return prisma.groupMember.create({
      data: {
        groupId,
        userId,
        role,
      },
    });
  }

  async removeMember(groupId: string, userId: string) {
    return prisma.groupMember.deleteMany({
      where: {
        groupId,
        userId,
      },
    });
  }

  async getMember(groupId: string, userId: string) {
    return prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });
  }

  async getMembers(groupId: string) {
    return prisma.groupMember.findMany({
      where: {
        groupId,
        user: {
          deletedAt: null,
        },
      },
      include: {
        user: { select: { id: true, email: true, name: true, avatar: true } },
      },
    });
  }

  async createInvite(groupId: string, userId: string) {
    return prisma.groupInvite.upsert({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
      create: {
        groupId,
        userId,
        status: "pending",
      },
      update: {
        status: "pending",
        invitedAt: new Date(),
        respondedAt: null,
      },
    });
  }

  async getInvite(groupId: string, userId: string) {
    return prisma.groupInvite.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });
  }

  async respondToInvite(groupId: string, userId: string, status: string) {
    // Update invite status
    const updated = await prisma.groupInvite.update({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
      data: {
        status,
        respondedAt: new Date(),
      },
    });

    // If accepted, add user as member
    if (status === "accepted") {
      await this.addMember(groupId, userId, "member");
    }

    return updated;
  }

  async deleteInvite(groupId: string, userId: string) {
    return prisma.groupInvite.deleteMany({
      where: {
        groupId,
        userId,
        status: "pending",
      },
    });
  }

  async getPendingInvites(userId: string) {
    return prisma.groupInvite.findMany({
      where: {
        userId,
        status: "pending",
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            description: true,
            type: true,
            avatar: true,
          },
        },
      },
    });
  }
}
