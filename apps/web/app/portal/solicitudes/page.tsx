import { redirect } from "next/navigation";
import { getPortalProfile } from "@/features/portal/api";
import { PortalRequestsView } from "@/features/portal/portal-module-views";
import { getServerToken } from "@/lib/server-auth";

export default async function PortalRequestsPage() {
  const token = await getServerToken();
  const profile = await getPortalProfile(token);

  if (!profile) {
    redirect("/login");
  }

  return <PortalRequestsView profile={profile} />;
}
