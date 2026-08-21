import { redirect } from "next/navigation";
import { getPortalProfile } from "@/features/portal/api";
import { PortalHomeView } from "@/features/portal/portal-home-view";
import { getServerToken } from "@/lib/server-auth";

export default async function PortalPage() {
  const token = await getServerToken();
  const profile = await getPortalProfile(token);

  if (!profile) {
    redirect("/portal/login");
  }

  return <PortalHomeView profile={profile} />;
}
