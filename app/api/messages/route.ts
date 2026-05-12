import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { detectMessageType, validateMediaData } from "@/lib/media";
import { notifyChatMembers } from "@/lib/push";
import { decryptMessage, decryptMessages, encryptMessageField } from "@/lib/message-crypto";

export const runtime = "nodejs";

const postSchema = z.object({
  chatId: z.string().min(1),
  text: z.string().trim().max(4000).optional().or(z.literal("")),
  mediaData: z.string().max(6_000_000).optional(),
  mediaMime: z.string().max(100).optional(),
  mediaName: z.string().max(180).optional(),
  replyToId: z.string().min(1).optional().nullable()
});

function publicUserSelect() {
  return { id: true, username: true, displayName: true, avatarData: true } as const;
}

const replySelect = {
  id: true,
  chatId: true,
  senderId: true,
  type: true,
  text: true,
  mediaMime: true,
  mediaName: true,
  createdAt: true,
  sender: { select: { id: true, username: true, displayName: true, avatarData: true } }
} as const;

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
  replyTo: { select: replySelect },
  sender: { select: publicUserSelect() }
} as const;

async function getReaders(chatId: string) {
  return db.chatMember.findMany({
    where: { chatId },
    select: { userId: true, lastReadAt: true }
  });
}

function attachReadReceipts<T extends { id: string; senderId: string | null; createdAt: Date }>(messages: T[], readers: { userId: string; lastReadAt: Date | null }[]) {
  return messages.map((message) => {
    const otherReaders = readers.filter((reader) => reader.userId !== message.senderId);
    const readByOthers = Boolean(
      message.senderId &&
      otherReaders.length > 0 &&
      otherReaders.every((reader) => reader.lastReadAt && reader.lastReadAt.getTime() >= message.createdAt.getTime())
    );
    return { ...message, readByOthers };
  });
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Не авторизован.", 401);

  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get("chatId");
  const after = searchParams.get("after");
  const statusOnly = searchParams.get("statusOnly") === "1";
  if (!chatId) return jsonError("chatId обязателен.", 400);

  const membership = await db.chatMember.findUnique({ where: { userId_chatId: { userId: user.id, chatId } } });
  if (!membership) return jsonError("Нет доступа к чату.", 403);

  await db.chatMember.update({
    where: { userId_chatId: { userId: user.id, chatId } },
    data: { lastReadAt: new Date() }
  });

  const readers = await getReaders(chatId);

  if (statusOnly) {
    const messages = await db.message.findMany({
      where: {
        chatId,
        senderId: user.id,
        deletedForEveryone: false,
        hiddenFor: { none: { userId: user.id } }
      },
      orderBy: { createdAt: "asc" },
      take: 200,
      select: { id: true, senderId: true, createdAt: true }
    });
    return NextResponse.json({ receipts: attachReadReceipts(messages, readers).map((message) => ({ id: message.id, readByOthers: message.readByOthers })) });
  }

  const messages = await db.message.findMany({
    where: {
      chatId,
      deletedForEveryone: false,
      hiddenFor: { none: { userId: user.id } },
      ...(after ? { createdAt: { gt: new Date(after) } } : {})
    },
    orderBy: { createdAt: "asc" },
    take: after ? 100 : 200,
    select: selectMessage
  });

  return NextResponse.json({ messages: attachReadReceipts(decryptMessages(messages), readers) });
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

  let replyToId: string | null = null;
  if (parsed.data.replyToId) {
    const replyTo = await db.message.findFirst({
      where: {
        id: parsed.data.replyToId,
        chatId: parsed.data.chatId,
        deletedForEveryone: false
      },
      select: { id: true }
    });
    if (replyTo) replyToId = replyTo.id;
  }

  const type = parsed.data.mediaData ? detectMessageType(parsed.data.mediaMime) : "TEXT";

  const message = await db.message.create({
    data: {
      chatId: parsed.data.chatId,
      senderId: user.id,
      text: encryptMessageField(cleanText),
      mediaData: encryptMessageField(parsed.data.mediaData),
      mediaMime: parsed.data.mediaMime || null,
      mediaName: encryptMessageField(parsed.data.mediaName),
      replyToId,
      type
    },
    select: selectMessage
  });

  await db.chatMember.update({
    where: { userId_chatId: { userId: user.id, chatId: parsed.data.chatId } },
    data: { lastReadAt: new Date() }
  });

  await db.chat.update({ where: { id: parsed.data.chatId }, data: { updatedAt: new Date() } });

  await notifyChatMembers(parsed.data.chatId, user.id, {
    title: user.displayName || user.username,
    body: cleanText || (type === "IMAGE" ? "Отправил фото" : type === "VIDEO" ? "Отправил видео" : "Отправил файл"),
    url: "/chat"
  }).catch(() => undefined);

  return NextResponse.json({ message: { ...decryptMessage(message), readByOthers: false } });
}
