import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getEmailSessionUser } from "@/app/email-access";
import { canManageDocuments } from "@/app/lib/authz";
import { getDocument } from "@/app/lib/blob-storage";
import { getDb } from "@/db";
import { documents } from "@/db/schema";

export const dynamic = "force-dynamic";

const DOCUMENT_TYPES = new Set([
  "TDS",
  "SDS",
  "COA",
  "Composition",
  "COO",
  "Presentation",
  "RIS",
  "Clinical Test",
  "Product Information",
  "Certificate",
  "Other",
]);

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getEmailSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: "Vui lòng đăng nhập để tải tài liệu." },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  const [row] = await getDb()
    .select()
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);
  if (!row) {
    return NextResponse.json({ error: "Không tìm thấy tài liệu." }, { status: 404 });
  }

  const object = await getDocument(row.objectKey);
  if (!object) {
    return NextResponse.json(
      { error: "Tệp hiện không khả dụng." },
      { status: 404 },
    );
  }

  const fallbackName = row.filename.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const objectResponse = await fetch(object.url);
  return new Response(objectResponse.body, {
    headers: {
      "Content-Type": row.contentType,
      "Content-Length": String(row.sizeBytes),
      "Content-Disposition": `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(row.filename)}`,
      "Cache-Control": "private, max-age=60",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getEmailSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  }
  if (!canManageDocuments(user)) {
    return NextResponse.json(
      { error: "Tài khoản này không có quyền chỉnh sửa tài liệu." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const payload = (await request.json()) as {
    documentType?: unknown;
    filename?: unknown;
  };
  const documentType = String(payload.documentType ?? "").trim();
  const filename = String(payload.filename ?? "").trim();
  if (!DOCUMENT_TYPES.has(documentType)) {
    return NextResponse.json({ error: "Loại tài liệu không hợp lệ." }, { status: 400 });
  }
  if (!filename || filename.length > 180) {
    return NextResponse.json({ error: "Tên tài liệu không hợp lệ." }, { status: 400 });
  }

  const [existing] = await getDb()
    .select({ id: documents.id })
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);
  if (!existing) {
    return NextResponse.json({ error: "Không tìm thấy tài liệu." }, { status: 404 });
  }

  await getDb()
    .update(documents)
    .set({ documentType, filename })
    .where(eq(documents.id, id));

  return NextResponse.json({ document: { id, documentType, filename } });
}
