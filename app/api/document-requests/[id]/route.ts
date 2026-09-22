import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getEmailSessionUser } from "@/app/email-access";
import { canManageDocuments } from "@/app/lib/authz";
import { getDb } from "@/db";
import { documentRequests } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function PATCH(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getEmailSessionUser();
  if (!user) return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  if (!canManageDocuments(user)) return NextResponse.json({ error: "Bạn không có quyền xử lý yêu cầu." }, { status: 403 });
  const { id } = await context.params;
  const [record] = await getDb().select().from(documentRequests).where(eq(documentRequests.id, id)).limit(1);
  if (!record) return NextResponse.json({ error: "Không tìm thấy yêu cầu." }, { status: 404 });

  const resolvedAt = new Date();
  await getDb().update(documentRequests).set({ status: "resolved", resolvedAt, resolvedByEmail: user.email }).where(eq(documentRequests.id, id));
  return NextResponse.json({ request: { ...record, status: "resolved", resolvedAt, resolvedByEmail: user.email } });
}
