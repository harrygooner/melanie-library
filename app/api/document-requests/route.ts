import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getEmailSessionUser } from "@/app/email-access";
import { canManageDocuments } from "@/app/lib/authz";
import { getDb } from "@/db";
import { documentRequests } from "@/db/schema";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set([
  "TDS", "SDS", "COA", "Composition", "COO", "Presentation", "RIS",
  "Clinical Test", "Product Information", "Certificate", "Other",
]);

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  const user = await getEmailSessionUser();
  if (!user) return jsonError("Vui lòng đăng nhập.", 401);
  const productId = new URL(request.url).searchParams.get("productId")?.trim();
  if (!productId) return jsonError("Thiếu mã nguyên liệu.", 400);

  const condition = canManageDocuments(user)
    ? eq(documentRequests.productId, productId)
    : and(eq(documentRequests.productId, productId), eq(documentRequests.requesterEmail, user.email));
  const rows = await getDb().select().from(documentRequests).where(condition).orderBy(desc(documentRequests.createdAt));
  return NextResponse.json({ requests: rows });
}

export async function POST(request: Request) {
  const user = await getEmailSessionUser();
  if (!user) return jsonError("Vui lòng đăng nhập.", 401);
  const payload = (await request.json()) as {
    productId?: unknown;
    productName?: unknown;
    requestedTypes?: unknown;
    note?: unknown;
  };
  const productId = String(payload.productId ?? "").trim();
  const productName = String(payload.productName ?? "").trim().slice(0, 180);
  const requestedTypes = Array.isArray(payload.requestedTypes)
    ? [...new Set(payload.requestedTypes.map(String).filter((value) => ALLOWED_TYPES.has(value)))].slice(0, 11)
    : [];
  const note = String(payload.note ?? "").trim().slice(0, 1000);
  if (!productId || !productName) return jsonError("Thiếu thông tin nguyên liệu.", 400);
  if (!requestedTypes.length) return jsonError("Vui lòng chọn ít nhất một loại tài liệu.", 400);

  const id = crypto.randomUUID();
  const createdAt = new Date();
  await getDb().insert(documentRequests).values({
    id,
    productId,
    productName,
    requestedTypes: requestedTypes.join(", "),
    note,
    requesterId: user.userId,
    requesterEmail: user.email,
    status: "pending",
    createdAt,
  });
  return NextResponse.json({ request: { id, productId, productName, requestedTypes: requestedTypes.join(", "), note, requesterEmail: user.email, status: "pending", createdAt } }, { status: 201 });
}
