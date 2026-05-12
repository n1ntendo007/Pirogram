import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { isAdminUser, isMaintenanceMode, setMaintenanceMode } from "@/lib/admin";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

const schema = z.object({ enabled: z.boolean() });

export async function GET() {
  const user = await getCurrentUser();
  const enabled = await isMaintenanceMode();
  return NextResponse.json({ enabled, isAdmin: isAdminUser(user) });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Не авторизован.", 401);
  if (!isAdminUser(user)) return jsonError("Эта настройка доступна только @admin.", 403);

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Некорректный режим обслуживания.", 400);

  await setMaintenanceMode(parsed.data.enabled);
  return NextResponse.json({ enabled: parsed.data.enabled, isAdmin: true });
}
