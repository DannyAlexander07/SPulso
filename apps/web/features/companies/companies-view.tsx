import Link from "next/link";
import { Building2, Eye, Factory, Layers3 } from "lucide-react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { Badge } from "@/components/ui/badge";
import { CrudSection } from "@/components/ui/crud-section";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/surface";
import type { AuthUser } from "@/features/auth/types";
import { canManageCompanies } from "@/features/auth/permissions";
import { CompaniesExportButton } from "./companies-export-button";
import { CompanyFiltersForm } from "./company-filters";
import { CompanyRowActions } from "./company-row-actions";
import { CreateCompanyForm } from "./create-company-form";
import type { Company, CompanyFilters } from "./types";

export function CompaniesView({
  companies,
  currentUser,
  filters,
}: {
  companies: Company[];
  currentUser: AuthUser | null;
  filters: CompanyFilters;
}) {
  const activeCompanies = companies.filter((company) => company.status === "ACTIVE");
  const canManage = canManageCompanies(currentUser);

  return (
    <main className="min-h-screen bg-[#f4f6f8] text-[#1f242d]">
      <div className="grid min-h-screen lg:grid-cols-[216px_minmax(0,1fr)]">
        <AppSidebar activePath="/empresas" currentUser={currentUser} />

        <section className="min-w-0">
          <AppTopbar currentUser={currentUser} eyebrow="Empresas" title="Gestion multiempresa" />

          <div className="w-full px-4 py-4 pb-24 sm:px-5 lg:px-6 lg:pb-4">
            <section className="grid gap-4 md:grid-cols-3">
              <MetricCard icon={Layers3} label="Grupo empresarial" value="Grupo SP" />
              <MetricCard
                icon={Building2}
                label="Empresas activas"
                tone="success"
                value={activeCompanies.length.toString()}
              />
              <MetricCard
                icon={Factory}
                label="Preparado para crecer"
                tone="warning"
                value="+ empresas"
              />
            </section>

            <CrudSection
              actions={
                <>
                  <CompaniesExportButton companies={companies} />
                  {canManage ? <CreateCompanyForm /> : null}
                </>
              }
              className="mt-4"
              description="Administra datos, estado y reglas de asistencia por empresa."
              eyebrow="Directorio"
              filters={<CompanyFiltersForm filters={filters} />}
              title="Empresas del grupo"
            >
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {companies.length > 0 ? (
                  companies.map((company, index) => (
                  <article
                    className="animate-rise rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-3 transition duration-200 hover:-translate-y-1 hover:border-[#818cf8] hover:bg-white hover:shadow-[0_18px_40px_rgba(16,24,40,0.08)]"
                    key={company.id}
                    style={{ animationDelay: `${index * 70}ms` }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eef2ff] text-sm font-bold text-[#4f46e5]">
                        {company.name.slice(0, 2).toUpperCase()}
                      </div>
                      <Badge tone={company.status === "ACTIVE" ? "success" : "neutral"}>
                        {company.status === "ACTIVE" ? "Activa" : "Inactiva"}
                      </Badge>
                    </div>
                    <h3 className="mt-4 whitespace-normal break-words text-base font-semibold leading-5">{company.name}</h3>
                    <p className="mt-1 whitespace-normal break-words text-sm leading-5 text-[#667085]">{company.slug}</p>
                    <div className="mt-4 whitespace-normal break-words rounded-xl bg-white px-3 py-3 text-xs leading-5 text-[#667085]">
                      RUC: {company.ruc ?? "Pendiente"}
                    </div>
                    <div className="mt-2 whitespace-normal break-words rounded-xl bg-white px-3 py-3 text-xs leading-5 text-[#667085]">
                      Jornada:{" "}
                      <span className="font-semibold text-[#475467]">
                        {company.workStartTime} + {company.lateToleranceMinutes} min
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <Link
                        className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#c7d2fe] bg-[#f7f7ff] px-3 text-xs font-bold text-[#4f46e5] transition hover:bg-[#c7d2fe]"
                        href={`/empresas/${company.id}`}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Ver perfil
                      </Link>
                      {canManage ? (
                        <CompanyRowActions company={company} />
                      ) : null}
                    </div>
                  </article>
                  ))
                ) : (
                  <div className="xl:col-span-4">
                    <EmptyState
                      description="Cambia los filtros o registra una empresa nueva."
                      icon={Building2}
                      title="No hay empresas con los filtros seleccionados"
                    />
                  </div>
                )}
              </div>
            </CrudSection>
          </div>
        </section>
      </div>
    </main>
  );
}
