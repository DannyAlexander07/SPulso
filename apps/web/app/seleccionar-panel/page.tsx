import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/api";
import { getWorkspaceAccess } from "@/features/auth/access";
import { WorkspaceSelector } from "@/features/auth/workspace-selector";
import { getServerToken } from "@/lib/server-auth";

export default async function SelectWorkspacePage() {
  const token = await getServerToken();
  const user = await getCurrentUser(token);

  if (!user) {
    redirect("/login");
  }

  const access = getWorkspaceAccess(user);

  if (access.admin && !access.portal) {
    redirect("/");
  }

  if (!access.admin && access.portal) {
    redirect("/portal");
  }

  return <WorkspaceSelector user={user} />;
}
