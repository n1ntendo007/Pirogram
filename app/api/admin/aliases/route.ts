import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { assertUsernameFree, isAdminUser, normalizePublicUsername } from "@/lib/admin";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

const schema = z.object({ username: z.string().min(3).max(32) });

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Не авторизован.", 401);
  if (!isAdminUser(user)) return jsonError("Дополнительные юзернеймы доступны только @admin.", 403);

  const aliases = await db.usernameAlias.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { username: true, createdAt: true }
  });
  return NextResponse.json({ aliases });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Не авторизован.", 401);
  if (!isAdminUser(user)) return jsonError("Дополнительные юзернеймы доступны только @admin.", 403);

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Введите свободный @username.", 400);

  const free = await assertUsernameFree(parsed.data.username, user.id);
  if (!free.ok) return jsonError(free.error, 409);
  if (free.username === user.username) return jsonError("Это уже основной @username админа.", 409);

  await db.usernameAlias.create({ data: { userId: user.id, username: free.username } });
  const aliases = await db.usernameAlias.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" }, select: { username: true, createdAt: true } });
  return NextResponse.json({ aliases });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Не авторизован.", 401);
  if (!isAdminUser(user)) return jsonError("Дополнительные юзернеймы доступны только @admin.", 403);

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Введите @username для удаления.", 400);

  const username = normalizePublicUsername(parsed.data.username);
  await db.usernameAlias.deleteMany({ where: { userId: user.id, username } });
  const aliases = await db.usernameAlias.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" }, select: { username: true, createdAt: true } });
  return NextResponse.json({ aliases });
}
