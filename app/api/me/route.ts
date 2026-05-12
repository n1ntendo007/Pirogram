import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { isAdminUser, isMaintenanceMode } from "@/lib/admin";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

const patchSchema = z.object({
  displayName: z.string().trim().min(1).max(40).optional(),
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

  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      ...(parsed.data.displayName !== undefined ? { displayName: parsed.data.displayName.trim() } : {}),
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
