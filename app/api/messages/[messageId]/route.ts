import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ messageId: string }>;
};

const deleteSchema = z.object({
  scope: z.enum(["me", "everyone"]).default("me")
});

export async function DELETE(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Не авторизован.", 401);

  const { messageId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) return jsonError("Некорректный способ удаления.", 400);

  const message = await db.message.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      chatId: true,
      senderId: true,
      deletedForEveryone: true,
      chat: { select: { type: true } }
    }
  });

  if (!message || message.deletedForEveryone) return jsonError("Сообщение не найдено.", 404);

  const membership = await db.chatMember.findUnique({
    where: { userId_chatId: { userId: user.id, chatId: message.chatId } },
    select: { id: true }
  });
  if (!membership) return jsonError("Нет доступа к этому сообщению.", 403);

  if (parsed.data.scope === "everyone") {
    if (message.senderId !== user.id) return jsonError("Удалить у всех можно только своё сообщение.", 403);
    await db.message.update({
      where: { id: message.id },
      data: {
        deletedForEveryone: true,
        deletedAt: new Date(),
        text: null,
        mediaData: null,
        mediaMime: null,
        mediaName: null
      }
    });
    await db.messageReaction.deleteMany({ where: { messageId: message.id } });
    await db.chat.update({ where: { id: message.chatId }, data: { updatedAt: new Date() } });
    return NextResponse.json({ ok: true, scope: "everyone" });
  }

  await db.messageDeletion.upsert({
    where: { messageId_userId: { messageId: message.id, userId: user.id } },
    update: {},
    create: { messageId: message.id, userId: user.id }
  });

  return NextResponse.json({ ok: true, scope: "me" });
}
