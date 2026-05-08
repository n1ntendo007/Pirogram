import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getClientIp, jsonError } from "@/lib/http";
import { hashPassword, validatePasswordStrength } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { createSessionToken, setSessionCookie } from "@/lib/session";
import { normalizeLogin, normalizeUsername, validateLogin, validateUsername } from "@/lib/username";

export const runtime = "nodejs";

const schema = z.object({
  displayName: z.string().trim().max(40).optional().or(z.literal("")),
  login: z.string().min(3).max(32),
  username: z.string().min(3).max(32),
  password: z.string().min(8).max(128)
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = rateLimit(`register:${ip}`, 30, 10 * 60 * 1000);
  if (!limit.ok) return jsonError("Слишком много попыток. Попробуйте позже.", 429);

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Проверьте ник, логин, юзернейм и пароль.", 400);

  const login = normalizeLogin(parsed.data.login);
  const username = normalizeUsername(parsed.data.username);

  const loginError = validateLogin(login);
  if (loginError) return jsonError(loginError, 400);

  const usernameError = validateUsername(username);
  if (usernameError) return jsonError(usernameError, 400);

  const passwordError = validatePasswordStrength(parsed.data.password);
  if (passwordError) return jsonError(passwordError, 400);

  const existingLogin = await db.user.findUnique({ where: { login } });
  if (existingLogin) return jsonError("Такой логин уже занят.", 409);

  const existingUsername = await db.user.findUnique({ where: { username } });
  if (existingUsername) return jsonError("Такой @username уже занят.", 409);

  const passwordHash = await hashPassword(parsed.data.password);
  const displayName = parsed.data.displayName?.trim() || username;

  const user = await db.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: { login, username, passwordHash, displayName },
      select: { id: true, username: true, displayName: true, avatarData: true }
    });

    const savedChat = await tx.chat.create({
      data: {
        type: "SAVED",
        title: "Избранное",
        members: { create: { userId: createdUser.id, role: "owner", lastReadAt: new Date() } }
      }
    });

    await tx.message.create({
      data: {
        chatId: savedChat.id,
        senderId: createdUser.id,
        type: "SYSTEM",
        text: "Добро пожаловать в Pirogram. Это ваш личный чат для заметок, фото и видео."
      }
    });

    return createdUser;
  });

  const token = await createSessionToken({ userId: user.id, username: user.username });
  const response = NextResponse.json({ user });
  setSessionCookie(response, token);
  return response;
}
