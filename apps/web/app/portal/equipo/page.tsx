import { redirect } from "next/navigation";
import { getPortalProfile } from "@/features/portal/api";
import { PortalTeamView } from "@/features/portal/portal-module-views";
import { getServerToken } from "@/lib/server-auth";

export default async function PortalTeamPage() {
  const token = await getServerToken();
  const profile = await getPortalProfile(token);

  if (!profile) {
    redirect("/login");
  }

  return <PortalTeamView profile={profile} />;
}
