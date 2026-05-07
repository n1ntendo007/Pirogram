import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { detectMessageType, validateMediaData } from "@/lib/media";
import { notifyChatMembers } from "@/lib/push";

export const runtime = "nodejs";

const postSchema = z.object({
  chatId: z.string().min(1),
  text: z.string().trim().max(4000).optional().or(z.literal("")),
  mediaData: z.string().max(6_000_000).optional(),
  mediaMime: z.string().max(100).optional(),
  mediaName: z.string().max(180).optional()
});

const selectMessage = {
  id: true,
  chatId: true,
  senderId: true,
  type: true,
  text: true,
  mediaData: true,
  mediaMime: true,
  mediaName: true,
  createdAt: true,
  sender: { select: { id: true, username: true, displayName: true, avatarData: true } }
} as const;

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Не авторизован.", 401);

  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get("chatId");
  const after = searchParams.get("after");
  if (!chatId) return jsonError("chatId обязателен.", 400);

  const membership = await db.chatMember.findUnique({ where: { userId_chatId: { userId: user.id, chatId } } });
  if (!membership) return jsonError("Нет доступа к чату.", 403);

  const messages = await db.message.findMany({
    where: {
      chatId,
      ...(after ? { createdAt: { gt: new Date(after) } } : {})
    },
    orderBy: { createdAt: "asc" },
    take: after ? 100 : 200,
    select: selectMessage
  });

  return NextResponse.json({ messages });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Не авторизован.", 401);

  const body = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return jsonError("Некорректное сообщение.", 400);

  const membership = await db.chatMember.findUnique({ where: { userId_chatId: { userId: user.id, chatId: parsed.data.chatId } } });
  if (!membership) return jsonError("Нет доступа к чату.", 403);

  const cleanText = parsed.data.text?.trim() || "";
  const mediaError = validateMediaData(parsed.data.mediaData, parsed.data.mediaMime);
  if (mediaError) return jsonError(mediaError, 400);

  if (!cleanText && !parsed.data.mediaData) return jsonError("Сообщение не может быть пустым.", 400);

  const type = parsed.data.mediaData ? detectMessageType(parsed.data.mediaMime) : "TEXT";

  const message = await db.message.create({
    data: {
      chatId: parsed.data.chatId,
      senderId: user.id,
      text: cleanText || null,
      mediaData: parsed.data.mediaData || null,
      mediaMime: parsed.data.mediaMime || null,
      mediaName: parsed.data.mediaName || null,
      type
    },
    select: selectMessage
  });

  await db.chat.update({ where: { id: parsed.data.chatId }, data: { updatedAt: new Date() } });

  await notifyChatMembers(parsed.data.chatId, user.id, {
    title: user.displayName || user.username,
    body: cleanText || (type === "IMAGE" ? "Отправил фото" : type === "VIDEO" ? "Отправил видео" : "Отправил файл"),
    url: "/chat"
  }).catch(() => undefined);

  return NextResponse.json({ message });
}
