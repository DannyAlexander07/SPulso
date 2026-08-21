import { redirect } from "next/navigation";
import { getPortalProfile } from "@/features/portal/api";
import { PortalAttendancePanel } from "@/features/portal/portal-attendance-panel";
import { PortalShell } from "@/features/portal/portal-shell";
import { getServerToken } from "@/lib/server-auth";

export default async function PortalAttendancePage() {
  const token = await getServerToken();
  const profile = await getPortalProfile(token);

  if (!profile) {
    redirect("/login");
  }

  return (
    <PortalShell activePath="/portal/marcacion" profile={profile} title="Marcacion">
      <section className="mt-4 rounded-[26px] border border-[#dfe5ee] bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#667085]">Asistencia</p>
        <h1 className="mt-2 max-w-3xl text-2xl font-semibold leading-tight sm:text-3xl">
          Marca tu entrada o salida desde tu portal.
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#667085]">
          El sistema pedira ubicacion GPS y tu PIN personal para registrar evidencia de asistencia.
        </p>
      </section>
      <PortalAttendancePanel
        companySlug={profile.employee.company.slug}
        identifier={profile.employee.employeeCode ?? profile.employee.documentNumber ?? ""}
        userAvatarUrl={profile.employee.user?.avatarUrl}
      />
    </PortalShell>
  );
}
