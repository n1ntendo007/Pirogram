import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { normalizeUsername } from "@/lib/username";
import { decryptMessages } from "@/lib/message-crypto";

export const runtime = "nodejs";

const createChatSchema = z.object({
  username: z.string().min(2).max(32).optional(),
  type: z.enum(["PRIVATE", "GROUP"]).optional(),
  title: z.string().trim().min(1).max(64).optional(),
  usernames: z.array(z.string().min(2).max(32)).max(50).optional()
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

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Не авторизован.", 401);

  const chats = await db.chat.findMany({
    where: { members: { some: { userId: user.id } } },
    orderBy: { updatedAt: "desc" },
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
          hiddenFor: { none: { userId: user.id } }
        },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: publicMessageSelect()
      }
    }
  });

  const normalized = await Promise.all(chats.map(async (chat) => {
    const other = chat.members.map((m) => m.user).find((member) => member.id !== user.id);
    const me = chat.members.find((member) => member.userId === user.id);
    const unreadCount = await unreadCountFor(chat.id, user.id, me?.lastReadAt);
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
  }));

  return NextResponse.json({ chats: normalized });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Не авторизован.", 401);

  const body = await request.json().catch(() => null);
  const parsed = createChatSchema.safeParse(body);
  if (!parsed.success) return jsonError("Некорректные данные чата.", 400);

  if (parsed.data.type === "GROUP") {
    const title = parsed.data.title?.trim();
    if (!title) return jsonError("Введите название общего чата.", 400);

    const usernames = cleanUsernameList(parsed.data.usernames, user.username);
    const users = usernames.length ? await db.user.findMany({
      where: { username: { in: usernames } },
      select: publicUserSelect()
    }) : [];

    const missing = usernames.filter((username) => !users.some((item) => item.username === username));
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
      include: {
        members: { select: { user: { select: publicUserSelect() } }, orderBy: { joinedAt: "asc" } },
        messages: { orderBy: { createdAt: "desc" }, take: 1, select: publicMessageSelect() }
      }
    });

    return NextResponse.json({
      chat: {
        id: chat.id,
        type: "GROUP",
        title: chat.title,
        username: null,
        avatarData: chat.avatarData,
        updatedAt: chat.updatedAt,
        unreadCount: 0,
        memberCount: chat.members.length,
        members: chat.members.map((member) => member.user),
        messages: decryptMessages(chat.messages)
      }
    });
  }

  if (!parsed.data.username) return jsonError("Введите @username пользователя.", 400);

  const username = normalizeUsername(parsed.data.username);
  if (username === user.username) return jsonError("Нельзя создать диалог с самим собой. Используйте Избранное.", 400);

  const target = await db.user.findUnique({ where: { username }, select: publicUserSelect() });
  if (!target) return jsonError("Пользователь с таким @username не найден.", 404);

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
    const chat = await db.chat.findUnique({
      where: { id: existingChatId },
      include: { messages: { where: { deletedForEveryone: false, hiddenFor: { none: { userId: user.id } } }, orderBy: { createdAt: "desc" }, take: 1, select: publicMessageSelect() } }
    });
    return NextResponse.json({
      chat: {
        id: existingChatId,
        type: "PRIVATE",
        title: target.displayName || target.username,
        username: target.username,
        avatarData: target.avatarData,
        updatedAt: chat?.updatedAt,
        unreadCount: 0,
        memberCount: 2,
        members: [target, user],
        messages: decryptMessages(chat?.messages ?? [])
      }
    });
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
    include: { messages: { orderBy: { createdAt: "desc" }, take: 1, select: publicMessageSelect() } }
  });

  return NextResponse.json({
    chat: {
      id: chat.id,
      type: "PRIVATE",
      title: target.displayName || target.username,
      username: target.username,
      avatarData: target.avatarData,
      updatedAt: chat.updatedAt,
      unreadCount: 0,
      memberCount: 2,
      members: [target, user],
      messages: decryptMessages(chat.messages)
    }
  });
}
