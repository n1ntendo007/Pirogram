import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getClientIp, jsonError } from "@/lib/http";
import { verifyPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { createSessionToken, setSessionCookie } from "@/lib/session";
import { normalizeLogin, normalizeUsername } from "@/lib/username";

export const runtime = "nodejs";

const schema = z.object({
  login: z.string().min(3).max(32).optional(),
  username: z.string().min(3).max(32).optional(),
  password: z.string().min(1).max(128)
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = rateLimit(`login:${ip}`, 60, 10 * 60 * 1000);
  if (!limit.ok) return jsonError("Слишком много попыток входа. Попробуйте позже.", 429);

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Введите логин и пароль.", 400);

  const rawIdentifier = parsed.data.login || parsed.data.username || "";
  const login = normalizeLogin(rawIdentifier);
  const username = normalizeUsername(rawIdentifier);
  if (!login) return jsonError("Введите логин и пароль.", 400);

  const user = await db.user.findFirst({
    where: { OR: [{ login }, { username }] }
  });

  if (!user) return jsonError("Неверный логин или пароль.", 401);

  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) return jsonError("Неверный логин или пароль.", 401);

  const token = await createSessionToken({ userId: user.id, username: user.username });
  const response = NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarData: user.avatarData
    }
  });
  setSessionCookie(response, token);
  return response;
}
