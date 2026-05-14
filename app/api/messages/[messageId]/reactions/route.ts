import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { isMaintenanceBlocked } from "@/lib/admin";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ messageId: string }>;
};

const reactionSchema = z.object({
  emoji: z.enum(["💋", "❤️‍🔥"])
});

async function assertMessageAccess(messageId: string, userId: string) {
  const message = await db.message.findUnique({
    where: { id: messageId },
    select: { id: true, chatId: true, deletedForEveryone: true }
  });

  if (!message || message.deletedForEveryone) return { error: jsonError("Сообщение не найдено.", 404) };

  const membership = await db.chatMember.findUnique({
    where: { userId_chatId: { userId, chatId: message.chatId } },
    select: { id: true }
  });

  if (!membership) return { error: jsonError("Нет доступа к этому сообщению.", 403) };
  return { message };
}

async function getReactions(messageId: string) {
  return db.messageReaction.findMany({
    where: { messageId },
    orderBy: { createdAt: "asc" },
    select: { emoji: true, userId: true, createdAt: true }
  });
}

export async function PUT(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Не авторизован.", 401);
  if (await isMaintenanceBlocked(user)) return jsonError("Закрыто на тех обслуживание.", 503);

  const { messageId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = reactionSchema.safeParse(body);
  if (!parsed.success) return jsonError("Можно выбрать только 💋 или ❤️‍🔥.", 400);

  const access = await assertMessageAccess(messageId, user.id);
  if (access.error) return access.error;

  const existing = await db.messageReaction.findUnique({
    where: { messageId_userId: { messageId, userId: user.id } },
    select: { emoji: true }
  });

  if (existing?.emoji === parsed.data.emoji) {
    await db.messageReaction.delete({ where: { messageId_userId: { messageId, userId: user.id } } });
  } else {
    await db.messageReaction.upsert({
      where: { messageId_userId: { messageId, userId: user.id } },
      update: { emoji: parsed.data.emoji },
      create: { messageId, userId: user.id, emoji: parsed.data.emoji }
    });
  }

  return NextResponse.json({ ok: true, messageId, reactions: await getReactions(messageId) });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Не авторизован.", 401);
  if (await isMaintenanceBlocked(user)) return jsonError("Закрыто на тех обслуживание.", 503);

  const { messageId } = await context.params;
  const access = await assertMessageAccess(messageId, user.id);
  if (access.error) return access.error;

  await db.messageReaction.deleteMany({ where: { messageId, userId: user.id } });
  return NextResponse.json({ ok: true, messageId, reactions: await getReactions(messageId) });
}
