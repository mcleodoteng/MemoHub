import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const isDryRun = process.argv.includes("--dry-run");

function normalizeParticipantIds(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function cleanupGroupConversations() {
  const conversations = await prisma.conversation.findMany({
    where: {
      type: "group",
      NOT: { groupId: null },
    },
    orderBy: [{ groupId: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      groupId: true,
      name: true,
      createdAt: true,
      participantIds: true,
    },
  });

  const grouped = new Map();
  for (const conversation of conversations) {
    const key = conversation.groupId;
    if (!key) continue;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(conversation);
  }

  const duplicateGroups = Array.from(grouped.entries()).filter(
    ([, convs]) => convs.length > 1,
  );

  if (duplicateGroups.length === 0) {
    console.log("No duplicate group conversations found.");
    return;
  }

  let groupsProcessed = 0;
  let conversationsDeleted = 0;
  let messagesMoved = 0;

  for (const [groupId, convs] of duplicateGroups) {
    const keep = convs[0];
    const duplicates = convs.slice(1);

    const mergedParticipants = Array.from(
      new Set(convs.flatMap((c) => normalizeParticipantIds(c.participantIds))),
    );

    if (isDryRun) {
      const duplicateIds = duplicates.map((d) => d.id);
      console.log(
        `[dry-run] group=${groupId} keep=${keep.id} delete=${duplicateIds.join(",")}`,
      );
      groupsProcessed += 1;
      conversationsDeleted += duplicates.length;
      continue;
    }

    const movedForGroup = await prisma.$transaction(async (tx) => {
      await tx.conversation.update({
        where: { id: keep.id },
        data: {
          participantIds: mergedParticipants,
        },
      });

      let movedMessages = 0;
      for (const duplicate of duplicates) {
        const moved = await tx.message.updateMany({
          where: { conversationId: duplicate.id },
          data: { conversationId: keep.id },
        });

        movedMessages += moved.count;

        await tx.conversation.delete({
          where: { id: duplicate.id },
        });
      }

      return movedMessages;
    });

    groupsProcessed += 1;
    conversationsDeleted += duplicates.length;
    messagesMoved += movedForGroup;

    console.log(
      `Merged group ${groupId}: kept ${keep.id}, deleted ${duplicates.length} duplicates, moved ${movedForGroup} messages`,
    );
  }

  console.log(
    `Done. groups=${groupsProcessed}, deletedConversations=${conversationsDeleted}, movedMessages=${messagesMoved}`,
  );
}

cleanupGroupConversations()
  .catch((error) => {
    console.error("Cleanup failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
