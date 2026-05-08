import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { normalizeUsername } from "@/lib/username";

export const runtime = "nodejs";

const createPrivateSchema = z.object({ username: z.string().min(2).max(32) });

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
    sender: { select: { id: true, username: true, displayName: true, avatarData: true } }
  } as const;
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
          lastReadAt: true,
          user: { select: { id: true, username: true, displayName: true, avatarData: true } }
        }
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: publicMessageSelect()
      }
    }
  });

  const normalized = await Promise.all(chats.map(async (chat) => {
    const other = chat.members.map((m) => m.user).find((member) => member.id !== user.id);
    const me = chat.members.find((member) => member.userId === user.id);
    const unreadCount = await db.message.count({
      where: {
        chatId: chat.id,
        senderId: { not: user.id },
        ...(me?.lastReadAt ? { createdAt: { gt: me.lastReadAt } } : {})
      }
    });

    return {
      id: chat.id,
      type: chat.type,
      title: chat.type === "PRIVATE" ? other?.displayName || other?.username || "Диалог" : chat.title,
      username: chat.type === "PRIVATE" ? other?.username : null,
      avatarData: chat.type === "PRIVATE" ? other?.avatarData : chat.avatarData,
      updatedAt: chat.updatedAt,
      unreadCount,
      members: chat.members.map((member) => member.user),
      messages: chat.messages
    };
  }));

  return NextResponse.json({ chats: normalized });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Не авторизован.", 401);

  const body = await request.json().catch(() => null);
  const parsed = createPrivateSchema.safeParse(body);
  if (!parsed.success) return jsonError("Введите @username пользователя.", 400);

  const username = normalizeUsername(parsed.data.username);
  if (username === user.username) return jsonError("Нельзя создать диалог с самим собой. Используйте Избранное.", 400);

  const target = await db.user.findUnique({ where: { username }, select: { id: true, username: true, displayName: true, avatarData: true } });
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
      include: { messages: { orderBy: { createdAt: "desc" }, take: 1, select: publicMessageSelect() } }
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
        members: [target, user],
        messages: chat?.messages ?? []
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
      members: [target, user],
      messages: chat.messages
    }
  });
}
