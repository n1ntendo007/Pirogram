import { NextResponse } from "next/server";
import { getVapidPublicKey } from "@/lib/push";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  const publicKey = getVapidPublicKey();
  if (!publicKey) return jsonError("VAPID ключи не настроены на сервере.", 503);
  return NextResponse.json({ publicKey });
}
