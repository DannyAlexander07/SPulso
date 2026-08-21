import { redirect } from "next/navigation";
import { getPortalProfile } from "@/features/portal/api";
import { PortalBenefitsView } from "@/features/portal/portal-module-views";
import { getServerToken } from "@/lib/server-auth";

export default async function PortalBenefitsPage() {
  const token = await getServerToken();
  const profile = await getPortalProfile(token);

  if (!profile) {
    redirect("/login");
  }

  return <PortalBenefitsView profile={profile} />;
}
