import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { notifyChatMembers } from "@/lib/push";

export const runtime = "nodejs";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Не авторизован.", 401);

  const saved = await db.chat.findFirst({ where: { type: "SAVED", members: { some: { userId: user.id } } } });
  if (!saved) return jsonError("Сначала создайте чат.", 400);

  await notifyChatMembers(saved.id, "system", {
    title: "Pirogram",
    body: "Тестовое уведомление работает.",
    url: "/chat"
  });

  return NextResponse.json({ ok: true });
}
