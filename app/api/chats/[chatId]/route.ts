import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ chatId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Не авторизован.", 401);

  const { chatId } = await context.params;
  if (!chatId) return jsonError("chatId обязателен.", 400);

  const membership = await db.chatMember.findUnique({
    where: { userId_chatId: { userId: user.id, chatId } },
    include: { chat: { select: { id: true, type: true } } }
  });

  if (!membership) return jsonError("Нет доступа к этому чату.", 403);
  if (membership.chat.type === "SAVED") return jsonError("Избранное нельзя удалить.", 400);

  await db.chat.delete({ where: { id: chatId } });

  return NextResponse.json({ ok: true });
}
