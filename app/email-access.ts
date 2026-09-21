import { cookies } from "next/headers";

export const EMAIL_SESSION_COOKIE = "sapharchem_email";

const ACCESS_USERS = new Map([
  ["lqmai.sdh242@hcmut.edu.vn", "Mai"],
  ["melanie@sapharchem.com", "Melanie"],
  ["quynhmaile03072@gmail.com", "Quỳnh Mai"],
  ["lqmai.sdh242@gmail.com", "Quỳnh Mai"],
  ["daisy@sapharchem.com", "Daisy"],
  ["claire@sapharchem.com", "Claire"],
  ["monica@sapharchem.com", "Monica"],
  ["ivy@novalab.com.vn", "Ivy"],
  ["mina@sapharchem.com", "Mina"],
]);

export const DOCUMENT_ADMIN_EMAILS = new Set([
  "lqmai.sdh242@hcmut.edu.vn",
  "melanie@sapharchem.com",
  "quynhmaile03072@gmail.com",
  "lqmai.sdh242@gmail.com",
]);

export type EmailSessionUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function getAllowedEmailUser(value: string): EmailSessionUser | null {
  const email = normalizeEmail(value);
  const displayName = ACCESS_USERS.get(email);
  if (!displayName) return null;
  return { userId: `email:${email}`, displayName, email, fullName: displayName };
}

export async function getEmailSessionUser(): Promise<EmailSessionUser | null> {
  const cookieStore = await cookies();
  const email = cookieStore.get(EMAIL_SESSION_COOKIE)?.value ?? "";
  return getAllowedEmailUser(email);
}
