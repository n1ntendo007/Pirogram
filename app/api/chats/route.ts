import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { isMaintenanceBlocked } from "@/lib/admin";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { normalizeUsername } from "@/lib/username";
import { decryptMessages } from "@/lib/message-crypto";

export const runtime = "nodejs";

const createChatSchema = z.object({
  username: z.string().min(2).max(64).optional(),
  type: z.enum(["PRIVATE", "GROUP"]).optional(),
  title: z.string().trim().min(1).max(64).optional(),
  usernames: z.array(z.string().min(2).max(64)).max(50).optional(),
  userIds: z.array(z.string().min(1)).max(50).optional()
});

function publicUserSelect() {
  return { id: true, username: true, displayName: true, avatarData: true, aliases: { select: { username: true }, orderBy: { createdAt: "asc" } } } as const;
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
    replyTo: {
      select: {
        id: true,
        senderId: true,
        type: true,
        text: true,
        mediaMime: true,
        mediaName: true,
        createdAt: true,
        sender: { select: publicUserSelect() }
      }
    },
    sender: { select: publicUserSelect() }
  } as const;
}

function cleanUsernameList(values: string[] | undefined, currentUsername: string) {
  return [...new Set((values ?? [])
    .flatMap((value) => value.split(/[\s,;]+/))
    .map((value) => normalizeUsername(value))
    .filter((value) => value && value !== currentUsername))];
}

async function usersByHandlesAndIds(handles: string[], userIds: string[], currentUserId: string) {
  const usersById = new Map<string, { id: string; username: string; displayName: string; avatarData: string | null; aliases?: { username: string }[] }>();
  const cleanIds = [...new Set(userIds.filter((id) => id && id !== currentUserId))];

  if (cleanIds.length) {
    const users = await db.user.findMany({ where: { id: { in: cleanIds, not: currentUserId } }, select: publicUserSelect() });
    for (const user of users) usersById.set(user.id, user);
  }

  if (handles.length) {
    const users = await db.user.findMany({
      where: {
        id: { not: currentUserId },
        OR: [
          { username: { in: handles } },
          { aliases: { some: { username: { in: handles } } } }
        ]
      },
      select: publicUserSelect()
    });
    for (const user of users) usersById.set(user.id, user);
  }

  return [...usersById.values()];
}

async function findPrivateTarget(handleOrName: string, currentUserId: string) {
  const raw = handleOrName.trim();
  const username = normalizeUsername(raw);
  return db.user.findFirst({
    where: {
      id: { not: currentUserId },
      OR: [
        { username },
        { aliases: { some: { username } } },
        { displayName: { equals: raw, mode: "insensitive" } }
      ]
    },
    select: publicUserSelect()
  });
}

async function unreadCountFor(chatId: string, userId: string, lastReadAt?: Date | null) {
  return db.message.count({
    where: {
      chatId,
      deletedForEveryone: false,
      hiddenFor: { none: { userId } },
      senderId: { not: userId },
      ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {})
    }
  });
}

async function serializeChat(chatId: string, userId: string) {
  const chat = await db.chat.findUnique({
    where: { id: chatId },
    include: {
      members: {
        select: {
          userId: true,
          role: true,
          lastReadAt: true,
          user: { select: publicUserSelect() }
        },
        orderBy: { joinedAt: "asc" }
      },
      messages: {
        where: {
          deletedForEveryone: false,
          hiddenFor: { none: { userId } }
        },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: publicMessageSelect()
      }
    }
  });
  if (!chat) return null;
  const other = chat.members.map((m) => m.user).find((member) => member.id !== userId);
  const me = chat.members.find((member) => member.userId === userId);
  const unreadCount = await unreadCountFor(chat.id, userId, me?.lastReadAt);
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

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Не авторизован.", 401);
  if (await isMaintenanceBlocked(user)) return jsonError("Закрыто на тех обслуживание.", 503);

  const chatRefs = await db.chat.findMany({
    where: { members: { some: { userId: user.id } } },
    orderBy: { updatedAt: "desc" },
    select: { id: true }
  });

  const chats = await Promise.all(chatRefs.map((chat) => serializeChat(chat.id, user.id)));
  return NextResponse.json({ chats: chats.filter(Boolean) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Не авторизован.", 401);
  if (await isMaintenanceBlocked(user)) return jsonError("Закрыто на тех обслуживание.", 503);

  const body = await request.json().catch(() => null);
  const parsed = createChatSchema.safeParse(body);
  if (!parsed.success) return jsonError("Некорректные данные чата.", 400);

  if (parsed.data.type === "GROUP") {
    const title = parsed.data.title?.trim();
    if (!title) return jsonError("Введите название общего чата.", 400);

    const handles = cleanUsernameList(parsed.data.usernames, user.username);
    const users = await usersByHandlesAndIds(handles, parsed.data.userIds ?? [], user.id);
    const foundNames = new Set(users.flatMap((item) => [item.username, ...(item.aliases ?? []).map((alias) => alias.username)]));
    const missing = handles.filter((username) => !foundNames.has(username));
    if (missing.length) return jsonError(`Не найдены пользователи: @${missing.join(", @")}`, 404);

    const chat = await db.chat.create({
      data: {
        type: "GROUP",
        title,
        members: {
          create: [
            { userId: user.id, role: "owner", lastReadAt: new Date() },
            ...users.map((member) => ({ userId: member.id, role: "member" }))
          ]
        }
      },
      select: { id: true }
    });

    return NextResponse.json({ chat: await serializeChat(chat.id, user.id) });
  }

  if (!parsed.data.username) return jsonError("Введите @username или ник пользователя.", 400);

  const normalized = normalizeUsername(parsed.data.username);
  if (normalized === user.username) return jsonError("Нельзя создать диалог с самим собой. Используйте Избранное.", 400);

  const target = await findPrivateTarget(parsed.data.username, user.id);
  if (!target) return jsonError("Пользователь с таким @username или ником не найден.", 404);

  const existingMemberships = await db.chatMember.findMany({
    where: { userId: { in: [user.id, target.id] }, chat: { type: "PRIVATE" } },
    select: { chatId: true, userId: true }
  });

  const byChat = new Map<string, Set<string>>();
  for (const membership of existingMemberships) {
    const set = byChat.get(membership.chatId) || new Set<string>();
    set.add(membership.userId);
    byChat.set(membership.chatId, set);
  }
  const existingChatId = [...byChat.entries()].find(([, ids]) => ids.has(user.id) && ids.has(target.id))?.[0];

  if (existingChatId) {
    await db.chatMember.update({ where: { userId_chatId: { userId: user.id, chatId: existingChatId } }, data: { lastReadAt: new Date() } });
    return NextResponse.json({ chat: await serializeChat(existingChatId, user.id) });
  }

  const chat = await db.chat.create({
    data: {
      type: "PRIVATE",
      members: {
        create: [
          { userId: user.id, role: "member", lastReadAt: new Date() },
          { userId: target.id, role: "member" }
        ]
      }
    },
    select: { id: true }
  });

  return NextResponse.json({ chat: await serializeChat(chat.id, user.id) });
}
