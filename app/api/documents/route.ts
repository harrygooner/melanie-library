import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getEmailSessionUser } from "@/app/email-access";
import { canManageDocuments } from "@/app/lib/authz";
import { deleteDocument, uploadDocument } from "@/app/lib/blob-storage";
import { getDb } from "@/db";
import { documents } from "@/db/schema";

export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 15 * 1024 * 1024;
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
const ALLOWED_EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "jpg",
  "jpeg",
  "png",
  "zip",
]);

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  const user = await getEmailSessionUser();
  if (!user) return jsonError("Vui lòng đăng nhập để xem tài liệu.", 401);

  const productId = new URL(request.url).searchParams.get("productId")?.trim();
  if (!productId) return jsonError("Thiếu mã nguyên liệu.", 400);

  const rows = await getDb()
    .select({
      id: documents.id,
      documentType: documents.documentType,
      filename: documents.filename,
      contentType: documents.contentType,
      sizeBytes: documents.sizeBytes,
      uploadedByEmail: documents.uploadedByEmail,
      createdAt: documents.createdAt,
    })
    .from(documents)
    .where(eq(documents.productId, productId))
    .orderBy(desc(documents.createdAt));

  return NextResponse.json({ documents: rows });
}

export async function POST(request: Request) {
  const user = await getEmailSessionUser();
  if (!user) return jsonError("Vui lòng đăng nhập.", 401);
  if (!canManageDocuments(user)) {
    return jsonError("Tài khoản này không có quyền tải tài liệu lên.", 403);
  }

  const form = await request.formData();
  const productId = String(form.get("productId") ?? "").trim();
  const documentType = String(form.get("documentType") ?? "").trim();
  const file = form.get("file");

  if (!productId) return jsonError("Thiếu mã nguyên liệu.", 400);
  if (!DOCUMENT_TYPES.has(documentType)) {
    return jsonError("Loại tài liệu không hợp lệ.", 400);
  }
  if (!(file instanceof File) || !file.name) {
    return jsonError("Vui lòng chọn tệp tài liệu.", 400);
  }
  if (file.size <= 0 || file.size > MAX_FILE_BYTES) {
    return jsonError("Tệp phải nhỏ hơn 15 MB.", 400);
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return jsonError("Định dạng tệp chưa được hỗ trợ.", 400);
  }

  const id = crypto.randomUUID();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-140);
  const objectKey = `documents/${productId}/${id}-${safeName}`;
  const contentType = file.type || "application/octet-stream";
  const createdAt = new Date();

  await uploadDocument(objectKey, file.stream(), contentType);

  try {
    await getDb().insert(documents).values({
      id,
      productId,
      documentType,
      filename: file.name,
      objectKey,
      contentType,
      sizeBytes: file.size,
      uploadedById: user.userId,
      uploadedByEmail: user.email,
      createdAt,
    });
  } catch (error) {
    await deleteDocument(objectKey);
    throw error;
  }

  return NextResponse.json(
    {
      document: {
        id,
        documentType,
        filename: file.name,
        contentType,
        sizeBytes: file.size,
        uploadedByEmail: user.email,
        createdAt,
      },
    },
    { status: 201 },
  );
}
