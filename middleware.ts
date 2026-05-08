import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE } from "@/lib/session";

const protectedPrefixes = ["/chat"];
const oldAuthPages = ["/login", "/register"];

function secretKey() {
  const secret = process.env.JWT_SECRET || "";
  return new TextEncoder().encode(secret);
}

async function hasValidSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) return false;
  try {
    await jwtVerify(token, secretKey());
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isProtected = protectedPrefixes.some((prefix) => path.startsWith(prefix));
  const isOldAuthPage = oldAuthPages.includes(path);

  if (!isProtected && !isOldAuthPage) return NextResponse.next();

  const loggedIn = await hasValidSession(request);

  if (isOldAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = loggedIn ? "/chat" : "/";
    return NextResponse.redirect(url);
  }

  if (isProtected && !loggedIn) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/chat/:path*", "/login", "/register"]
};
