import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

function turnUrls() {
  return (process.env.TURN_URLS || process.env.TURN_URL || "")
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Не авторизован.", 401);

  const iceServers: RTCIceServer[] = [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }
  ];

  const urls = turnUrls();
  const username = process.env.TURN_USERNAME || "";
  const credential = process.env.TURN_CREDENTIAL || process.env.TURN_PASSWORD || "";
  if (urls.length && username && credential) {
    iceServers.push({ urls, username, credential });
  }

  return NextResponse.json({ iceServers, hasTurn: iceServers.length > 1 });
}
