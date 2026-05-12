import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { isMaintenanceBlocked } from "@/lib/admin";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { notifyChatMembers } from "@/lib/push";
import { encryptMessageField } from "@/lib/message-crypto";

export const runtime = "nodejs";

const startSchema = z.object({
  chatId: z.string().min(1),
  kind: z.enum(["AUDIO", "VIDEO"]),
  offer: z.unknown().optional()
});

const patchSchema = z.object({
  callId: z.string().min(1),
  status: z.enum(["ACCEPTED", "ENDED", "MISSED", "DECLINED"]).optional(),
  answer: z.unknown().optional(),
  callerIce: z.unknown().optional(),
  receiverIce: z.unknown().optional()
});

const selectCall = {
  id: true,
  chatId: true,
  callerId: true,
  kind: true,
  status: true,
  offer: true,
  answer: true,
  callerIce: true,
  receiverIce: true,
  createdAt: true,
  updatedAt: true,
  endedAt: true,
  caller: { select: { id: true, username: true, displayName: true, avatarData: true, aliases: { select: { username: true }, orderBy: { createdAt: "asc" } } } }
} as const;

async function ensureMembership(userId: string, chatId: string) {
  return db.chatMember.findUnique({ where: { userId_chatId: { userId, chatId } } });
}

function normalizeIce(value: unknown): Prisma.InputJsonValue[] {
  if (!value) return [];
  return Array.isArray(value) ? (value as Prisma.InputJsonValue[]) : [value as Prisma.InputJsonValue];
}

function mergeIce(current: unknown, incoming: unknown): Prisma.InputJsonValue[] {
  const merged: Prisma.InputJsonValue[] = [];
  const seen = new Set<string>();
  for (const candidate of [...normalizeIce(current), ...normalizeIce(incoming)]) {
    const key = JSON.stringify(candidate);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(candidate);
    }
  }
  return merged.slice(-80);
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Не авторизован.", 401);
  if (await isMaintenanceBlocked(user)) return jsonError("Закрыто на тех обслуживание.", 503);

  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get("chatId");
  const callId = searchParams.get("callId");

  if (callId) {
    const call = await db.callSession.findUnique({ where: { id: callId }, select: selectCall });
    if (!call) return jsonError("Звонок не найден.", 404);
    const membership = await ensureMembership(user.id, call.chatId);
    if (!membership) return jsonError("Нет доступа к звонку.", 403);
    return NextResponse.json({ call });
  }

  if (!chatId) {
    const call = await db.callSession.findFirst({
      where: {
        status: { in: ["RINGING", "ACCEPTED"] },
        chat: { members: { some: { userId: user.id } } }
      },
      orderBy: { updatedAt: "desc" },
      select: selectCall
    });
    return NextResponse.json({ call });
  }

  const membership = await ensureMembership(user.id, chatId);
  if (!membership) return jsonError("Нет доступа к чату.", 403);

  const call = await db.callSession.findFirst({
    where: { chatId, status: { in: ["RINGING", "ACCEPTED"] } },
    orderBy: { createdAt: "desc" },
    select: selectCall
  });

  return NextResponse.json({ call });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Не авторизован.", 401);
  if (await isMaintenanceBlocked(user)) return jsonError("Закрыто на тех обслуживание.", 503);

  const body = await request.json().catch(() => null);
  const parsed = startSchema.safeParse(body);
  if (!parsed.success) return jsonError("Некорректные данные звонка.", 400);

  const membership = await ensureMembership(user.id, parsed.data.chatId);
  if (!membership) return jsonError("Нет доступа к чату.", 403);

  await db.callSession.updateMany({
    where: { chatId: parsed.data.chatId, status: { in: ["RINGING", "ACCEPTED"] } },
    data: { status: "ENDED", endedAt: new Date() }
  });

  const call = await db.callSession.create({
    data: {
      chatId: parsed.data.chatId,
      callerId: user.id,
      kind: parsed.data.kind,
      offer: parsed.data.offer === undefined ? undefined : (parsed.data.offer as Prisma.InputJsonValue)
    },
    select: selectCall
  });

  await db.message.create({
    data: {
      chatId: parsed.data.chatId,
      senderId: user.id,
      type: "CALL",
      text: encryptMessageField(parsed.data.kind === "VIDEO" ? "Начал видеозвонок" : "Начал аудиозвонок")
    }
  });

  await db.chat.update({ where: { id: parsed.data.chatId }, data: { updatedAt: new Date() } });

  await notifyChatMembers(parsed.data.chatId, user.id, {
    title: user.displayName || user.username,
    body: parsed.data.kind === "VIDEO" ? "Видеозвонок в Pirogram" : "Аудиозвонок в Pirogram",
    url: "/chat"
  }).catch(() => undefined);

  return NextResponse.json({ call });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Не авторизован.", 401);
  if (await isMaintenanceBlocked(user)) return jsonError("Закрыто на тех обслуживание.", 503);

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return jsonError("Некорректные данные звонка.", 400);

  const current = await db.callSession.findUnique({ where: { id: parsed.data.callId }, select: { chatId: true, callerIce: true, receiverIce: true } });
  if (!current) return jsonError("Звонок не найден.", 404);

  const membership = await ensureMembership(user.id, current.chatId);
  if (!membership) return jsonError("Нет доступа к звонку.", 403);

  const updateData: Prisma.CallSessionUpdateInput = {};
  if (parsed.data.status) {
    updateData.status = parsed.data.status;
    if (["ENDED", "MISSED", "DECLINED"].includes(parsed.data.status)) {
      updateData.endedAt = new Date();
    }
  }
  if (parsed.data.answer !== undefined) updateData.answer = parsed.data.answer as Prisma.InputJsonValue;
  if (parsed.data.callerIce !== undefined) updateData.callerIce = mergeIce(current.callerIce, parsed.data.callerIce);
  if (parsed.data.receiverIce !== undefined) updateData.receiverIce = mergeIce(current.receiverIce, parsed.data.receiverIce);

  const call = await db.callSession.update({
    where: { id: parsed.data.callId },
    data: updateData,
    select: selectCall
  });

  return NextResponse.json({ call });
}
