import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Не авторизован.", 401);

  await db.user.update({
    where: { id: user.id },
    data: { updatedAt: new Date() }
  });

  return NextResponse.json({ ok: true });
}
