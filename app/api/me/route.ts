import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { isAdminUser, isMaintenanceMode } from "@/lib/admin";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { normalizeUsername, validateUsername } from "@/lib/username";

export const runtime = "nodejs";

const patchSchema = z.object({
  displayName: z.string().trim().min(1).max(40).optional(),
  username: z.string().trim().min(3).max(32).optional(),
  avatarData: z.string().max(2_500_000).nullable().optional()
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Не авторизован.", 401);
  return NextResponse.json({ user, isAdmin: isAdminUser(user), maintenanceMode: await isMaintenanceMode() });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Не авторизован.", 401);

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return jsonError("Некорректные данные профиля.", 400);

  if (parsed.data.avatarData && !parsed.data.avatarData.startsWith("data:image/")) {
    return jsonError("Аватарка должна быть изображением.", 400);
  }

  let nextUsername: string | undefined;
  if (parsed.data.username !== undefined) {
    nextUsername = normalizeUsername(parsed.data.username);
    const usernameError = validateUsername(nextUsername);
    if (usernameError) return jsonError(usernameError, 400);

    if (nextUsername !== user.username) {
      const existingUser = await db.user.findUnique({ where: { username: nextUsername }, select: { id: true } });
      if (existingUser && existingUser.id !== user.id) return jsonError("Такой @username уже занят.", 409);

      const existingAlias = await db.usernameAlias.findUnique({ where: { username: nextUsername }, select: { userId: true } });
      if (existingAlias && existingAlias.userId !== user.id) return jsonError("Такой @username уже занят.", 409);
    }
  }

  if (nextUsername && nextUsername !== user.username) {
    await db.usernameAlias.deleteMany({ where: { userId: user.id, username: nextUsername } });
  }

  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      ...(parsed.data.displayName !== undefined ? { displayName: parsed.data.displayName.trim() } : {}),
      ...(nextUsername !== undefined ? { username: nextUsername } : {}),
      ...(parsed.data.avatarData !== undefined ? { avatarData: parsed.data.avatarData } : {})
    },
    select: {
      id: true,
      username: true,
      login: true,
      displayName: true,
      avatarData: true,
      aliases: { select: { username: true }, orderBy: { createdAt: "asc" } },
      createdAt: true
    }
  });

  return NextResponse.json({ user: updated, isAdmin: isAdminUser(updated), maintenanceMode: await isMaintenanceMode() });
}
