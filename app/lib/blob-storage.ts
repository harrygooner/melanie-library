import { del, head, put } from "@vercel/blob";

function getBlobToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN is required.");
  return token;
}

export function uploadDocument(key: string, body: ReadableStream<Uint8Array>, contentType: string) {
  return put(key, body, { access: "public", contentType, token: getBlobToken(), addRandomSuffix: false });
}

export function getDocument(key: string) {
  return head(key, { token: getBlobToken() });
}

export function deleteDocument(key: string) {
  return del(key, { token: getBlobToken() });
}