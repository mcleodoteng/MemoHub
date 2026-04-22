import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export class UserRepository {
  async findAll() {
    return prisma.user.findMany({
      where: {
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        bio: true,
        avatar: true,
        role: true,
        department: true,
        status: true,
        isBlocked: true,
        deletedAt: true,
        createdAt: true,
        lastLoginAt: true,
        twoFactorEnabled: true,
        sessionTimeoutMinutes: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findById(id: string) {
    return prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        bio: true,
        avatar: true,
        role: true,
        department: true,
        status: true,
        isBlocked: true,
        deletedAt: true,
        createdAt: true,
        lastLoginAt: true,
        twoFactorEnabled: true,
        sessionTimeoutMinutes: true,
      },
    });
  }

  async update(id: string, data: any) {
    return prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        bio: true,
        avatar: true,
        role: true,
        department: true,
        status: true,
        isBlocked: true,
        deletedAt: true,
        createdAt: true,
        lastLoginAt: true,
        twoFactorEnabled: true,
        sessionTimeoutMinutes: true,
      },
    });
  }

  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  async updatePasswordResetToken(id: string, token: string, expires: Date) {
    return prisma.user.update({
      where: { id },
      data: {
        passwordResetToken: token,
        passwordResetExpires: expires,
      } as any,
    });
  }

  async findByPasswordResetToken(token: string) {
    return prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: {
          gt: new Date(),
        },
      } as any,
    });
  }

  async updatePasswordAndClearResetToken(id: string, passwordHash: string) {
    return prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
      } as any,
    });
  }
}
