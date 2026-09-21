import { NextResponse } from "next/server";

import {
  EMAIL_SESSION_COOKIE,
  getAllowedEmailUser,
} from "@/app/email-access";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = (await request.json()) as { email?: unknown };
  const user = getAllowedEmailUser(String(payload.email ?? ""));
  if (!user) {
    return NextResponse.json(
      { error: "Email này chưa được cấp quyền truy cập." },
      { status: 403 },
    );
  }

  const response = NextResponse.json({ user });
  response.cookies.set(EMAIL_SESSION_COOKIE, user.email, {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(request.url).protocol == "https:",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.set(EMAIL_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(request.url).protocol == "https:",
    path: "/",
    maxAge: 0,
  });
  return response;
}
