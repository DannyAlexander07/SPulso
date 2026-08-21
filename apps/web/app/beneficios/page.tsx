import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { getCurrentUser } from "@/features/auth/api";
import { getBenefits } from "@/features/benefits/api";
import { BenefitsWorkspace } from "@/features/benefits/benefits-view";
import { getCompanies } from "@/features/companies/api";
import { getOrganization } from "@/features/organization/api";
import { getServerToken } from "@/lib/server-auth";

export default async function BeneficiosPage() {
  const token = await getServerToken();
  const [benefits, companies, currentUser, organization] = await Promise.all([
    getBenefits({}, token),
    getCompanies({}, token),
    getCurrentUser(token),
    getOrganization(undefined, token),
  ]);

  return (
    <main className="min-h-screen bg-[#f4f6f8] text-[#1f242d]">
      <div className="grid min-h-screen lg:grid-cols-[216px_minmax(0,1fr)]">
        <AppSidebar activePath="/beneficios" currentUser={currentUser} />

        <section className="min-w-0">
          <AppTopbar currentUser={currentUser} eyebrow="Beneficios" title="Intranet y segmentacion" />
          <BenefitsWorkspace
            benefits={benefits}
            companies={companies}
            currentUser={currentUser}
            organization={organization}
          />
        </section>
      </div>
    </main>
  );
}
