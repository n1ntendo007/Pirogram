import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isAdminUser, isMaintenanceBlocked } from "@/lib/admin";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { normalizeUsername } from "@/lib/username";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return jsonError("Не авторизован.", 401);
  if (await isMaintenanceBlocked(currentUser)) return jsonError("Закрыто на тех обслуживание.", 503);

  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get("q") || "";
  const includeSelf = searchParams.get("includeSelf") === "1" && isAdminUser(currentUser);
  const q = normalizeUsername(rawQuery);
  const displayQuery = rawQuery.trim();
  if (q.length < 2 && displayQuery.length < 2) return NextResponse.json({ users: [] });

  const users = await db.user.findMany({
    where: {
      ...(includeSelf ? {} : { id: { not: currentUser.id } }),
      OR: [
        { username: { contains: q, mode: "insensitive" } },
        { displayName: { contains: displayQuery, mode: "insensitive" } },
        { aliases: { some: { username: { contains: q, mode: "insensitive" } } } }
      ]
    },
    take: 12,
    orderBy: [{ displayName: "asc" }, { username: "asc" }],
    select: { id: true, username: true, displayName: true, avatarData: true, aliases: { select: { username: true }, orderBy: { createdAt: "asc" } } }
  });

  return NextResponse.json({ users });
}
