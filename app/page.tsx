import { CatalogApp } from "@/app/catalog-app";
import { EmailGate } from "@/app/email-gate";
import { getEmailSessionUser } from "@/app/email-access";
import { canManageDocuments } from "@/app/lib/authz";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getEmailSessionUser();
  if (!user) return <EmailGate />;

  return (
    <CatalogApp
      user={{ displayName: user.displayName, email: user.email }}
      isAdmin={canManageDocuments(user)}
      signOutHref="/api/email-session"
    />
  );
}
