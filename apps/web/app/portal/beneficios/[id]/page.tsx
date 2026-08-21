import { notFound, redirect } from "next/navigation";
import { getPortalProfile } from "@/features/portal/api";
import { PortalBenefitDetailView } from "@/features/portal/portal-module-views";
import { getServerToken } from "@/lib/server-auth";

export default async function PortalBenefitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const token = await getServerToken();
  const profile = await getPortalProfile(token);

  if (!profile) {
    redirect("/login");
  }

  const { id } = await params;
  const benefit = profile.benefits.find((item) => item.id === id);

  if (!benefit) {
    notFound();
  }

  return <PortalBenefitDetailView benefit={benefit} profile={profile} />;
}
