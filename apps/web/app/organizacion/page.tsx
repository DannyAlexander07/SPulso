import { getCurrentUser } from "@/features/auth/api";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { getCompanies } from "@/features/companies/api";
import { getOrganization } from "@/features/organization/api";
import { OrganizationWorkspace } from "@/features/organization/organization-view";
import { getServerToken } from "@/lib/server-auth";

export default async function OrganizacionPage({
  searchParams,
}: {
  searchParams?: Promise<{ empresa?: string }>;
}) {
  const params = await searchParams;
  const companyId = params?.empresa?.trim() || undefined;
  const token = await getServerToken();
  const [companies, currentUser, organization] = await Promise.all([
    getCompanies({}, token),
    getCurrentUser(token),
    getOrganization(companyId, token),
  ]);

  return (
    <main className="min-h-screen bg-[#f4f6f8] text-[#1f242d]">
      <div className="grid min-h-screen lg:grid-cols-[216px_minmax(0,1fr)]">
        <AppSidebar activePath="/organizacion" currentUser={currentUser} />

        <section className="min-w-0">
          <AppTopbar currentUser={currentUser} eyebrow="Organizacion" title="Areas, cargos y equipos" />
          <OrganizationWorkspace
            companies={companies}
            companyId={companyId}
            currentUser={currentUser}
            organization={organization}
          />
        </section>
      </div>
    </main>
  );
}
