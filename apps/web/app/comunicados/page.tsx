import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { getAnnouncements } from "@/features/announcements/api";
import { AnnouncementsWorkspace } from "@/features/announcements/announcements-view";
import { getCurrentUser } from "@/features/auth/api";
import { getCompanies } from "@/features/companies/api";
import { getOrganization } from "@/features/organization/api";
import { getServerToken } from "@/lib/server-auth";

export default async function ComunicadosPage() {
  const token = await getServerToken();
  const [announcements, companies, currentUser, organization] = await Promise.all([
    getAnnouncements({}, token),
    getCompanies({}, token),
    getCurrentUser(token),
    getOrganization(undefined, token),
  ]);

  return (
    <main className="min-h-screen bg-[#f4f6f8] text-[#1f242d]">
      <div className="grid min-h-screen lg:grid-cols-[216px_minmax(0,1fr)]">
        <AppSidebar activePath="/comunicados" currentUser={currentUser} />

        <section className="min-w-0">
          <AppTopbar currentUser={currentUser} eyebrow="Comunicados" title="Comunicacion interna" />
          <AnnouncementsWorkspace
            announcements={announcements}
            companies={companies}
            currentUser={currentUser}
            organization={organization}
          />
        </section>
      </div>
    </main>
  );
}
