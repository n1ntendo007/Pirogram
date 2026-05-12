import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { normalizeUsername } from "@/lib/username";
import { decryptMessages } from "@/lib/message-crypto";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ chatId: string }>;
};

const patchSchema = z.object({
  title: z.string().trim().min(1).max(64).optional()
});

const addMembersSchema = z.object({
  usernames: z.array(z.string().min(2).max(32)).min(1).max(50)
});

function publicUserSelect() {
  return { id: true, username: true, displayName: true, avatarData: true } as const;
}

function publicMessageSelect() {
  return {
    id: true,
    chatId: true,
    senderId: true,
    type: true,
    text: true,
    mediaMime: true,
    mediaName: true,
    createdAt: true,
    sender: { select: publicUserSelect() }
  } as const;
}

function cleanUsernameList(values: string[], currentUsername: string) {
  return [...new Set(values
    .flatMap((value) => value.split(/[\s,;]+/))
    .map((value) => normalizeUsername(value))
    .filter((value) => value && value !== currentUsername))];
}

async function getMembership(userId: string, chatId: string) {
  return db.chatMember.findUnique({
    where: { userId_chatId: { userId, chatId } },
    include: { chat: { select: { id: true, type: true, title: true, avatarData: true, updatedAt: true } } }
  });
}

async function serializeChat(chatId: string, userId: string) {
  const chat = await db.chat.findUnique({
    where: { id: chatId },
    include: {
      members: {
        select: {
          userId: true,
          lastReadAt: true,
          user: { select: publicUserSelect() }
        },
        orderBy: { joinedAt: "asc" }
      },
      messages: {
        where: { deletedForEveryone: false, hiddenFor: { none: { userId } } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: publicMessageSelect()
      }
    }
  });
  if (!chat) return null;
  const other = chat.members.map((member) => member.user).find((member) => member.id !== userId);
  const me = chat.members.find((member) => member.userId === userId);
  const unreadCount = await db.message.count({
    where: {
      chatId,
      deletedForEveryone: false,
      hiddenFor: { none: { userId } },
      senderId: { not: userId },
      ...(me?.lastReadAt ? { createdAt: { gt: me.lastReadAt } } : {})
    }
  });
  const members = chat.members.map((member) => member.user);
  return {
    id: chat.id,
    type: chat.type,
    title: chat.type === "PRIVATE" ? other?.displayName || other?.username || "Диалог" : chat.title,
    username: chat.type === "PRIVATE" ? other?.username : null,
    avatarData: chat.type === "PRIVATE" ? other?.avatarData : chat.avatarData,
    updatedAt: chat.updatedAt,
    unreadCount,
    memberCount: members.length,
    members,
    messages: decryptMessages(chat.messages)
  };
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Не авторизован.", 401);

  const { chatId } = await context.params;
  const membership = await getMembership(user.id, chatId);
  if (!membership) return jsonError("Нет доступа к этому чату.", 403);
  if (membership.chat.type !== "GROUP") return jsonError("Название можно менять только у общего чата.", 400);

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success || !parsed.data.title) return jsonError("Введите новое название чата.", 400);

  await db.chat.update({ where: { id: chatId }, data: { title: parsed.data.title, updatedAt: new Date() } });
  const chat = await serializeChat(chatId, user.id);
  return NextResponse.json({ chat });
}

export async function POST(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Не авторизован.", 401);

  const { chatId } = await context.params;
  const membership = await getMembership(user.id, chatId);
  if (!membership) return jsonError("Нет доступа к этому чату.", 403);
  if (membership.chat.type !== "GROUP") return jsonError("Приглашать людей можно только в общий чат.", 400);

  const body = await request.json().catch(() => null);
  const parsed = addMembersSchema.safeParse(body);
  if (!parsed.success) return jsonError("Введите @username пользователей.", 400);

  const usernames = cleanUsernameList(parsed.data.usernames, user.username);
  if (!usernames.length) return jsonError("Нет пользователей для приглашения.", 400);

  const users = await db.user.findMany({ where: { username: { in: usernames } }, select: publicUserSelect() });
  const missing = usernames.filter((username) => !users.some((item) => item.username === username));
  if (missing.length) return jsonError(`Не найдены пользователи: @${missing.join(", @")}`, 404);

  const existing = await db.chatMember.findMany({
    where: { chatId, userId: { in: users.map((item) => item.id) } },
    select: { userId: true }
  });
  const existingIds = new Set(existing.map((item) => item.userId));
  const toCreate = users.filter((item) => !existingIds.has(item.id));

  if (toCreate.length) {
    await db.chatMember.createMany({
      data: toCreate.map((member) => ({ chatId, userId: member.id, role: "member" })),
      skipDuplicates: true
    });
    await db.chat.update({ where: { id: chatId }, data: { updatedAt: new Date() } });
  }

  const chat = await serializeChat(chatId, user.id);
  return NextResponse.json({ chat, added: toCreate.length });
}

export async function DELETE(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Не авторизован.", 401);

  const { chatId } = await context.params;
  if (!chatId) return jsonError("chatId обязателен.", 400);

  const membership = await getMembership(user.id, chatId);
  if (!membership) return jsonError("Нет доступа к этому чату.", 403);
  if (membership.chat.type === "SAVED") return jsonError("Избранное нельзя удалить.", 400);

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode");

  if (mode === "leave") {
    if (membership.chat.type !== "GROUP") return jsonError("Выйти можно только из общего чата.", 400);
    await db.chatMember.delete({ where: { userId_chatId: { userId: user.id, chatId } } });
    const membersLeft = await db.chatMember.count({ where: { chatId } });
    if (membersLeft === 0) {
      await db.chat.delete({ where: { id: chatId } });
    } else {
      await db.chat.update({ where: { id: chatId }, data: { updatedAt: new Date() } });
    }
    return NextResponse.json({ ok: true, left: true });
  }

  await db.chat.delete({ where: { id: chatId } });

  return NextResponse.json({ ok: true });
}
