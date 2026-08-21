import { notFound } from "next/navigation";
import { getCurrentUser } from "@/features/auth/api";
import { getCompanies } from "@/features/companies/api";
import { getEmployeeProfile } from "@/features/employees/api";
import { EmployeeProfileView } from "@/features/employees/employee-profile-view";
import { getOrganization } from "@/features/organization/api";
import { getServerToken } from "@/lib/server-auth";

export default async function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const token = await getServerToken();
  const { id } = await params;
  const [currentUser, companies, profile, organization] = await Promise.all([
    getCurrentUser(token),
    getCompanies(undefined, token),
    getEmployeeProfile(id, token),
    getOrganization(undefined, token),
  ]);

  if (!profile) {
    notFound();
  }

  return (
    <EmployeeProfileView
      companies={companies}
      currentUser={currentUser}
      organization={organization}
      profile={profile}
    />
  );
}
