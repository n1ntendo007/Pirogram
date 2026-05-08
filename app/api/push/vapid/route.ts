import { NextResponse } from "next/server";
import { getVapidPublicKey } from "@/lib/push";

export const runtime = "nodejs";

export async function GET() {
  const publicKey = getVapidPublicKey();
  if (!publicKey) return NextResponse.json({ configured: false, publicKey: "" });
  return NextResponse.json({ configured: true, publicKey });
}
