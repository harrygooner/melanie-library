import { DOCUMENT_ADMIN_EMAILS } from "@/app/email-access";

export function canManageDocuments(user: { email: string } | null): boolean {
  return DOCUMENT_ADMIN_EMAILS.has(user?.email.trim().toLowerCase() ?? "");
}
