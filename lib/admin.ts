import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { normalizeUsername, validateUsername } from "@/lib/username";

export const ADMIN_USERNAME = "admin";
export const MAINTENANCE_KEY = "maintenanceMode";

export type AppUser = {
  id: string;
  username: string;
} | null | undefined;

export function isAdminUser(user: AppUser) {
  return user?.username === ADMIN_USERNAME;
}

export async function isMaintenanceMode() {
  const setting = await db.globalSetting.findUnique({ where: { key: MAINTENANCE_KEY } });
  return setting?.value === "on";
}

export async function setMaintenanceMode(enabled: boolean) {
  return db.globalSetting.upsert({
    where: { key: MAINTENANCE_KEY },
    update: { value: enabled ? "on" : "off" },
    create: { key: MAINTENANCE_KEY, value: enabled ? "on" : "off" }
  });
}

export async function isMaintenanceBlocked(user: AppUser) {
  if (isAdminUser(user)) return false;
  return isMaintenanceMode();
}

export function normalizePublicUsername(value: string) {
  return normalizeUsername(value);
}

export async function assertUsernameFree(username: string, excludeUserId?: string) {
  const clean = normalizePublicUsername(username);
  const validationError = validateUsername(clean);
  if (validationError) return { ok: false as const, error: validationError, username: clean };

  const user = await db.user.findUnique({ where: { username: clean }, select: { id: true } });
  if (user && user.id !== excludeUserId) return { ok: false as const, error: "Такой @username уже занят.", username: clean };

  const alias = await db.usernameAlias.findUnique({ where: { username: clean }, select: { userId: true } });
  if (alias && alias.userId !== excludeUserId) return { ok: false as const, error: "Такой @username уже занят как дополнительный юзернейм.", username: clean };
  if (alias && alias.userId === excludeUserId) return { ok: false as const, error: "Этот @username уже есть у пользователя.", username: clean };

  return { ok: true as const, username: clean };
}

export async function findUserByHandleOrName(value: string, excludeUserId?: string) {
  const raw = value.trim();
  const username = normalizePublicUsername(raw);
  if (!username && raw.length < 2) return null;

  const or: Prisma.UserWhereInput[] = [];
  if (username) {
    or.push({ username });
    or.push({ aliases: { some: { username } } });
  }
  if (raw) or.push({ displayName: { equals: raw, mode: "insensitive" } });

  return db.user.findFirst({
    where: {
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      OR: or
    },
    select: { id: true, username: true, displayName: true, avatarData: true }
  });
}
