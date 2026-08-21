import { redirect } from "next/navigation";
import { getPortalProfile } from "@/features/portal/api";
import { PortalAnnouncementsView } from "@/features/portal/portal-module-views";
import { getServerToken } from "@/lib/server-auth";

export default async function PortalComunicadosPage() {
  const token = await getServerToken();
  const profile = await getPortalProfile(token);

  if (!profile) {
    redirect("/login");
  }

  return <PortalAnnouncementsView profile={profile} />;
}
