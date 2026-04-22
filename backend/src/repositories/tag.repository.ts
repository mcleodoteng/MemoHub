import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export class TagRepository {
  async findAll(page = 1, limit = 50) {
    const [tags, total] = await Promise.all([
      prisma.tag.findMany({
        include: {
          memos: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: "asc" },
      }),
      prisma.tag.count(),
    ]);

    return {
      tags,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    return prisma.tag.findUnique({
      where: { id },
      include: {
        memos: true,
      },
    });
  }

  async findByName(name: string) {
    return prisma.tag.findFirst({
      where: { name: name },
    });
  }

  async getCategories() {
    const tags = await prisma.tag.findMany({
      select: { category: true },
      distinct: ["category"],
    });

    return tags.map((t) => t.category).filter(Boolean);
  }

  async create(data: { name: string; category: string; color: string }) {
    return prisma.tag.create({
      data,
    });
  }

  async update(id: string, data: any) {
    return prisma.tag.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return prisma.tag.delete({
      where: { id },
    });
  }
}
