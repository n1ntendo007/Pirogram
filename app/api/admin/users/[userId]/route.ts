import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { assertUsernameFree, isAdminUser } from "@/lib/admin";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

const schema = z.object({
  username: z.string().min(3).max(32).optional(),
  displayName: z.string().trim().min(1).max(40).optional()
});

export async function PATCH(request: Request, context: RouteContext) {
  const admin = await getCurrentUser();
  if (!admin) return jsonError("Не авторизован.", 401);
  if (!isAdminUser(admin)) return jsonError("Менять профили может только @admin.", 403);

  const { userId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Некорректные данные профиля.", 400);

  const target = await db.user.findUnique({ where: { id: userId }, select: { id: true, username: true } });
  if (!target) return jsonError("Пользователь не найден.", 404);

  const data: { username?: string; displayName?: string } = {};
  if (parsed.data.username !== undefined) {
    const free = await assertUsernameFree(parsed.data.username, target.id);
    if (!free.ok) return jsonError(free.error, 409);
    data.username = free.username;
  }
  if (parsed.data.displayName !== undefined) data.displayName = parsed.data.displayName.trim();

  const user = await db.user.update({
    where: { id: target.id },
    data,
    select: { id: true, username: true, displayName: true, avatarData: true, aliases: { select: { username: true }, orderBy: { createdAt: "asc" } } }
  });

  return NextResponse.json({ user });
}
