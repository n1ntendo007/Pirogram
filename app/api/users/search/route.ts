import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { normalizeUsername } from "@/lib/username";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return jsonError("Не авторизован.", 401);

  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get("q") || "";
  const q = normalizeUsername(rawQuery);
  const displayQuery = rawQuery.trim();
  if (q.length < 2 && displayQuery.length < 2) return NextResponse.json({ users: [] });

  const users = await db.user.findMany({
    where: {
      id: { not: currentUser.id },
      OR: [
        { username: { contains: q, mode: "insensitive" } },
        { displayName: { contains: displayQuery, mode: "insensitive" } }
      ]
    },
    take: 10,
    orderBy: [{ username: "asc" }],
    select: { id: true, username: true, displayName: true, avatarData: true }
  });

  return NextResponse.json({ users });
}
