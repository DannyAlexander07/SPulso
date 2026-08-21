import { notFound } from "next/navigation";
import { getCurrentUser } from "@/features/auth/api";
import { getCompanyProfile } from "@/features/companies/api";
import { CompanyProfileView } from "@/features/companies/company-profile-view";
import { getServerToken } from "@/lib/server-auth";

export default async function CompanyProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const token = await getServerToken();
  const { id } = await params;
  const [currentUser, profile] = await Promise.all([
    getCurrentUser(token),
    getCompanyProfile(id, token),
  ]);

  if (!profile) {
    notFound();
  }

  return <CompanyProfileView currentUser={currentUser} profile={profile} />;
}
