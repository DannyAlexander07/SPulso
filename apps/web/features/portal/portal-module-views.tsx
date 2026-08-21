import {
  Building2,
  CalendarDays,
  FileText,
  Gift,
  Mail,
  MapPin,
  Megaphone,
  Phone,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import { mediaUrl } from "@/lib/api";
import { DocumentFilePreview } from "@/features/documents/document-file-preview";
import Link from "next/link";
import { PortalAnnouncementReadButton } from "./portal-announcement-actions";
import { PortalDocumentActions } from "./portal-document-actions";
import { PortalProfileForm } from "./portal-profile-form";
import { PortalProfilePhotoForm } from "./portal-profile-photo-form";
import { PortalQuickRequest, PortalRequestButton } from "./portal-request-form";
import { PortalAvatar, PortalChevronAction, PortalEmpty, PortalPanel, PortalShell } from "./portal-shell";
import { PortalTeamDirectory } from "./portal-team-directory";
import type { PortalProfile } from "./types";

export function PortalDocumentsView({ profile }: { profile: PortalProfile }) {
  const groups = [
    { label: "Por firmar", items: profile.documents.filter((document) => document.status === "PENDING_SIGNATURE") },
    { label: "Mis documentos", items: profile.documents.filter((document) => document.status !== "PENDING_SIGNATURE") },
  ];

  return (
    <PortalShell activePath="/portal/documentos" profile={profile} title="Documentos">
      <ModuleHeader
        eyebrow="Documentos"
        title="Todo tu archivo laboral en un solo lugar."
        description="Revisa boletas, contratos, certificados y documentos pendientes de firma."
      />

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <PortalPanel icon="documents" title="Biblioteca documental">
          <div className="space-y-5">
            {groups.map((group) => (
              <div key={group.label}>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{group.label}</h3>
                  <span className="rounded-full bg-[#f2f4f7] px-3 py-1 text-xs font-bold text-[#667085]">{group.items.length}</span>
                </div>
                <div className="space-y-4">
                  {groupDocumentsByFolder(group.items).map((folder) => (
                    <div key={folder.label}>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">{folder.label}</p>
                      <div className="space-y-2">
                        {folder.items.map((document) => (
                          <DocumentCard key={document.id} document={document} />
                        ))}
                      </div>
                    </div>
                  ))}
                  {group.items.length === 0 ? <PortalEmpty text={`No tienes documentos en ${group.label.toLowerCase()}.`} /> : null}
                </div>
              </div>
            ))}
          </div>
        </PortalPanel>

        <PortalPanel title="Resumen" action={<PortalChevronAction label="Exportar" />}>
          <div className="grid gap-3">
            <SummaryTile label="Pendientes de firma" value={profile.summary.documentsToSign.toString()} />
            <SummaryTile label="Total visibles" value={profile.documents.length.toString()} />
            <SummaryTile label="Firmados" value={profile.documents.filter((document) => document.status === "SIGNED").length.toString()} />
          </div>
        </PortalPanel>
      </div>
    </PortalShell>
  );
}

function groupDocumentsByFolder(documents: PortalProfile["documents"]) {
  const groups = new Map<string, PortalProfile["documents"]>();

  for (const document of documents) {
    const folder = document.folderRef?.name ?? document.folder ?? "General";
    groups.set(folder, [...(groups.get(folder) ?? []), document]);
  }

  return Array.from(groups.entries()).map(([label, items]) => ({
    label,
    items,
  }));
}

export function PortalRequestsView({ profile }: { profile: PortalProfile }) {
  return (
    <PortalShell activePath="/portal/solicitudes" profile={profile} title="Solicitudes">
      <ModuleHeader
        eyebrow="Solicitudes"
        title="Pide vacaciones, permisos o avisos sin escribir correos."
        description="Desde aqui quedara el flujo para enviar, revisar estado y recibir aprobaciones."
      />

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <PortalPanel icon="requests" title="Mis solicitudes" action={<PortalRequestButton />}>
          <div className="space-y-2">
            {profile.requests.map((request) => (
              <RequestCard key={request.id} request={request} />
            ))}
            {profile.requests.length === 0 ? <PortalEmpty text="Aun no tienes solicitudes registradas." /> : null}
          </div>
        </PortalPanel>

        <PortalPanel icon="requests" title="Crear rapido">
          <div className="grid gap-3">
            <PortalQuickRequest type="VACATION" title="Vacaciones" description="Solicita descanso o feriado legal." />
            <PortalQuickRequest type="REMOTE_WORK" title="Dar aviso" description="Trabajo remoto, ausencia o novedad." />
            <PortalQuickRequest type="PERMISSION" title="Permiso" description="Salida, ausencia o permiso personal." />
          </div>
        </PortalPanel>
      </div>
    </PortalShell>
  );
}

export function PortalTeamView({ profile }: { profile: PortalProfile }) {
  const leader = profile.employee.team?.leader ?? profile.employee.manager;
  const employee = profile.employee;
  const teamName = employee.team?.name ?? "Sin equipo asignado";
  const teamAreaName = employee.team?.area?.name ?? "Sin area asignada al equipo";
  const teamClientName = employee.team?.client?.name ?? "Sin cliente principal";
  const personalAreaName = employee.areaRef?.name ?? employee.area ?? "Sin area personal";

  return (
    <PortalShell activePath="/portal/equipo" profile={profile} title="Mi equipo">
      <ModuleHeader
        eyebrow="Equipo"
        title="Tu equipo, responsable y contactos en una sola vista."
        description="Consulta quien lidera tu equipo, quienes trabajan contigo y como contactarlos sin depender de listas desordenadas."
      />

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <PortalPanel icon="users" title={teamName}>
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryTile label="Companeros" value={profile.teamMembers.length.toString()} />
            <SummaryTile label="Empresa" value={employee.company.name} />
            <SummaryTile label="Cliente principal" value={teamClientName} />
            <SummaryTile label="Area del equipo" value={teamAreaName} />
          </div>
          <div className="mt-4 rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">Como se usa esta estructura</p>
            <p className="mt-2 text-sm leading-6 text-[#667085]">
              Este equipo servira para aprobaciones, beneficios segmentados, comunicados internos, sorteos y reportes por responsable.
            </p>
          </div>
        </PortalPanel>

        <PortalPanel icon="security" title="Responsable">
          {leader ? <LeaderCard leader={leader} /> : <PortalEmpty text="Aun no hay responsable asignado." />}
        </PortalPanel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <PortalPanel icon="building" title="Estructura">
          <div className="space-y-3">
            <DataBox label="Empresa" value={employee.company.name} />
            <DataBox label="Cliente principal" value={teamClientName} />
            <DataBox label="Equipo" value={teamName} />
            <DataBox label="Area del equipo" value={teamAreaName} />
            <DataBox label="Area personal" value={personalAreaName} />
            <DataBox label="Tu cargo" value={employee.position?.name ?? employee.jobTitle ?? "Pendiente"} />
            {employee.clientAssignments.length > 0 ? (
              <div className="rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">Clientes asignados</p>
                <div className="mt-2 space-y-2">
                  {employee.clientAssignments.map((assignment) => (
                    <div className="rounded-xl bg-white px-3 py-2" key={assignment.id}>
                      <p className="text-sm font-semibold">{assignment.client.name}</p>
                      <p className="mt-1 text-xs leading-4 text-[#667085]">
                        {[assignment.area?.name, assignment.team?.name, assignment.role, assignment.isPrimary ? "Principal" : null].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </PortalPanel>

        <PortalPanel icon="users" title="Companeros">
          <PortalTeamDirectory members={profile.teamMembers} />
        </PortalPanel>
      </div>
    </PortalShell>
  );
}

export function PortalBenefitsView({ profile }: { profile: PortalProfile }) {
  return (
    <PortalShell activePath="/portal/beneficios" profile={profile} title="Beneficios">
      <ModuleHeader
        eyebrow="Beneficios"
        title="Beneficios, sorteos y convenios para tu empresa."
        description="Los beneficios se muestran segun empresa, equipo o disponibilidad general."
      />

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {profile.benefits.map((benefit) => (
          <PortalPanel
            key={benefit.id}
            icon="benefits"
            title={benefit.title}
            action={benefit.actionLabel ? <PortalChevronAction label={benefit.actionLabel} /> : undefined}
          >
            <div>
              <span className="rounded-full bg-[#eef2ff] px-3 py-1 text-xs font-bold text-[#4f46e5]">{benefit.category}</span>
              {benefit.isHighlighted ? <span className="ml-2 rounded-full bg-[#e0f2fe] px-3 py-1 text-xs font-bold text-[#0284c7]">Destacado</span> : null}
              <p className="mt-4 text-sm leading-6 text-[#667085]">{benefit.description}</p>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]">
                Alcance: {benefit.audienceScope === "ALL" ? "Todos" : benefit.audienceScope === "COMPANIES" ? "Por empresa" : "Por equipo"}
              </p>
              <Link
                className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-[#eef2ff] px-4 text-sm font-bold text-[#4f46e5] transition hover:bg-[#c7d2fe]"
                href={`/portal/beneficios/${benefit.id}`}
              >
                Ver detalle
              </Link>
            </div>
          </PortalPanel>
        ))}
        {profile.benefits.length === 0 ? <PortalEmpty text="Aun no tienes beneficios disponibles." /> : null}
      </div>
    </PortalShell>
  );
}

export function PortalAnnouncementsView({ profile }: { profile: PortalProfile }) {
  return (
    <PortalShell activePath="/portal/comunicados" profile={profile} title="Comunicados">
      <ModuleHeader
        eyebrow="Comunicados"
        title="Noticias y avisos importantes para ti."
        description="Aqui veras mensajes publicados para tu empresa, equipo o todo el grupo."
      />

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {profile.announcements.map((announcement) => (
          <PortalPanel
            key={announcement.id}
            icon="announcements"
            title={announcement.title}
            action={announcement.isPinned ? <PortalChevronAction label="Fijado" /> : undefined}
          >
            <div>
              <div className="flex flex-wrap gap-2">
                <AnnouncementPriorityBadge priority={announcement.priority} />
                <span className="rounded-full bg-[#f2f4f7] px-3 py-1 text-xs font-bold text-[#667085]">
                  {announcement.audienceScope === "ALL" ? "Grupo" : announcement.audienceScope === "COMPANIES" ? "Empresa" : "Equipo"}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    announcement.readAt ? "bg-[#e0f2fe] text-[#0284c7]" : "bg-[#fff7df] text-[#b86b00]"
                  }`}
                >
                  {announcement.readAt ? "Leido" : "Nuevo"}
                </span>
              </div>
              <p className="mt-4 text-sm leading-6 text-[#667085]">{announcement.message}</p>
              {announcement.imageUrl ? (
                <img
                  alt=""
                  className="mt-4 aspect-[16/7] w-full rounded-2xl border border-[#e1e5eb] object-cover"
                  src={mediaUrl(announcement.imageUrl)}
                />
              ) : null}
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]">
                {announcement.publishAt ? `Publicado ${formatDate(announcement.publishAt)}` : "Publicado"}
              </p>
              <PortalAnnouncementReadButton id={announcement.id} readAt={announcement.readAt} />
            </div>
          </PortalPanel>
        ))}
        {profile.announcements.length === 0 ? <PortalEmpty text="Aun no tienes comunicados disponibles." /> : null}
      </div>
    </PortalShell>
  );
}

export function PortalBenefitDetailView({ benefit, profile }: { benefit: PortalProfile["benefits"][number]; profile: PortalProfile }) {
  return (
    <PortalShell activePath="/portal/beneficios" profile={profile} title="Beneficios">
      <ModuleHeader
        eyebrow="Detalle de beneficio"
        title={benefit.title}
        description="Revisa si este beneficio aplica para ti, su vigencia y la accion disponible."
      />

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <PortalPanel icon="benefits" title="Informacion">
          <span className="rounded-full bg-[#eef2ff] px-3 py-1 text-xs font-bold text-[#4f46e5]">{benefit.category}</span>
          {benefit.isHighlighted ? <span className="ml-2 rounded-full bg-[#e0f2fe] px-3 py-1 text-xs font-bold text-[#0284c7]">Destacado</span> : null}
          <p className="mt-5 text-sm leading-6 text-[#667085]">{benefit.description}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <DataBox label="Alcance" value={benefit.audienceScope === "ALL" ? "Todos" : benefit.audienceScope === "COMPANIES" ? "Por empresa" : "Por equipo"} />
            <DataBox label="Vigencia" value={benefit.endsAt ? `Hasta ${formatDate(benefit.endsAt)}` : "Sin fecha limite"} />
          </div>
        </PortalPanel>

        <PortalPanel title="Accion">
          {benefit.actionUrl ? (
            <a
              className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#4f46e5] px-4 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(79,70,229,0.22)] transition hover:bg-[#4338ca]"
              href={benefit.actionUrl}
              rel="noreferrer"
              target="_blank"
            >
              {benefit.actionLabel ?? "Abrir beneficio"}
            </a>
          ) : (
            <button className="h-11 w-full rounded-xl bg-[#4f46e5] px-4 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(79,70,229,0.22)]" type="button">
              {benefit.actionLabel ?? "Solicitar informacion"}
            </button>
          )}
          <p className="mt-3 text-xs leading-5 text-[#667085]">
            Luego conectaremos esta accion a sorteos, postulaciones o solicitudes internas con seguimiento.
          </p>
        </PortalPanel>
      </div>
    </PortalShell>
  );
}

function AnnouncementPriorityBadge({ priority }: { priority: PortalProfile["announcements"][number]["priority"] }) {
  const tones = {
    IMPORTANT: "bg-[#fff7df] text-[#b86b00]",
    NORMAL: "bg-[#eef2ff] text-[#4f46e5]",
    URGENT: "bg-[#fee4e2] text-[#b42318]",
  };
  const labels = { IMPORTANT: "Importante", NORMAL: "Aviso", URGENT: "Urgente" };

  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${tones[priority]}`}>{labels[priority]}</span>;
}

export function PortalProfileView({ profile }: { profile: PortalProfile }) {
  const { employee } = profile;

  return (
    <PortalShell activePath="/portal/ficha" profile={profile} title="Mi ficha">
      <ModuleHeader
        eyebrow="Ficha laboral"
        title="Tu informacion personal y laboral."
        description="Aqui se concentrara la informacion contractual, datos de contacto, empresa, area, cargo y responsable."
      />

      <div className="mt-4 grid gap-4 xl:grid-cols-[360px_1fr]">
        <PortalPanel icon="user" title="Perfil">
          <div className="flex items-center gap-4">
            <PortalAvatar avatarUrl={employee.user?.avatarUrl} firstName={employee.firstName} lastName={employee.lastName} size="lg" />
            <div className="min-w-0">
              <p className="whitespace-normal break-words text-xl font-semibold leading-6">
                {employee.firstName} {employee.lastName}
              </p>
              <p className="mt-1 text-sm text-[#667085]">{employee.position?.name ?? employee.jobTitle ?? "Trabajador"}</p>
            </div>
          </div>
          <div className="mt-5 space-y-2">
            <InfoLine icon={Mail} label="Correo personal" value={employee.personalEmail ?? "Pendiente"} />
            <InfoLine icon={Phone} label="Celular" value={employee.phoneMobile ?? "Pendiente"} />
            <InfoLine icon={MapPin} label="Empresa" value={employee.company.name} />
          </div>
          <div className="mt-4">
            <PortalProfilePhotoForm employee={employee} />
          </div>
        </PortalPanel>

        <div className="space-y-4">
          <PortalPanel title="Datos personales editables">
            <PortalProfileForm employee={employee} />
          </PortalPanel>

          <PortalPanel title="Informacion laboral solo lectura">
            <div className="grid gap-3 md:grid-cols-2">
              <DataBox label="Codigo" value={employee.employeeCode ?? "Pendiente"} />
              <DataBox label="Documento" value={employee.documentNumber ?? "Pendiente"} />
              <DataBox label="Area" value={employee.areaRef?.name ?? employee.area ?? "Pendiente"} />
              <DataBox label="Cargo" value={employee.position?.name ?? employee.jobTitle ?? "Pendiente"} />
              <DataBox label="Equipo" value={employee.team?.name ?? "Sin equipo"} />
              <DataBox label="Jefe" value={employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName}` : "Pendiente"} />
              <DataBox label="Fecha de ingreso" value={employee.hireDate ? formatDate(employee.hireDate) : "Pendiente"} />
              <DataBox label="Estado" value="Activo" />
            </div>
          </PortalPanel>
        </div>
      </div>
    </PortalShell>
  );
}

function ModuleHeader({ description, eyebrow, title }: { description: string; eyebrow: string; title: string }) {
  return (
    <section className="mt-4 rounded-[26px] border border-[#dfe5ee] bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#667085]">{eyebrow}</p>
      <h1 className="mt-2 max-w-3xl text-2xl font-semibold leading-tight sm:text-3xl">{title}</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-[#667085]">{description}</p>
    </section>
  );
}

function DocumentCard({ document }: { document: PortalProfile["documents"][number] }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <p className="whitespace-normal break-words text-sm font-semibold leading-5">{document.title}</p>
        <p className="mt-1 text-xs text-[#667085]">
          {documentTypeLabel(document.type)} · {documentStatusLabel(document.status)}
        </p>
        {document.fileUrl ? (
          <DocumentFilePreview
            className="mt-3"
            fallbackName={document.title}
            fileName={document.fileName}
            fileSize={document.fileSize}
            fileUrl={document.fileUrl}
            mimeType={document.mimeType}
            showAction={false}
          />
        ) : null}
        {document.signedAt ? (
          <p className="mt-1 text-xs font-semibold text-[#027a48]">
            Firmado: {formatDate(document.signedAt)}
          </p>
        ) : null}
        {document.requiresSignature && !document.signedAt ? (
          <p className="mt-1 text-xs font-semibold text-[#b86b00]">
            Requiere firma
          </p>
        ) : null}
      </div>
      <PortalDocumentActions fileUrl={document.fileUrl} id={document.id} status={document.status} />
    </div>
  );
}

function RequestCard({ request }: { request: PortalProfile["requests"][number] }) {
  return (
    <div className="rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{request.title}</p>
          <p className="mt-1 text-xs text-[#667085]">
            {requestTypeLabel(request.type)} · {formatDate(request.startDate)}
          </p>
        </div>
        <StatusBadge status={request.status} />
      </div>
      {request.description ? <p className="mt-3 text-sm leading-5 text-[#667085]">{request.description}</p> : null}
    </div>
  );
}

function LeaderCard({ leader }: { leader: NonNullable<PortalProfile["employee"]["team"]>["leader"] | PortalProfile["employee"]["manager"] }) {
  if (!leader) {
    return null;
  }

  const role = leader.position?.name ?? leader.jobTitle ?? "Responsable";

  return (
    <div className="rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-3">
      <div className="flex items-start gap-3">
        <PortalAvatar firstName={leader.firstName} lastName={leader.lastName} />
        <div className="min-w-0">
          <p className="whitespace-normal break-words text-sm font-semibold leading-5">{leader.firstName} {leader.lastName}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-4 text-[#667085]">{role}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        {leader.personalEmail ? (
          <a className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#eef2ff] px-3 text-xs font-bold text-[#4f46e5]" href={`mailto:${leader.personalEmail}`}>
            <Mail className="h-4 w-4" />
            Enviar correo
          </a>
        ) : null}
        {leader.phoneMobile ? (
          <a className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-white px-3 text-xs font-bold text-[#475467]" href={`tel:${leader.phoneMobile}`}>
            <Phone className="h-4 w-4" />
            Llamar
          </a>
        ) : null}
        {!leader.personalEmail && !leader.phoneMobile ? <PortalEmpty text="Este responsable aun no tiene contacto visible." /> : null}
      </div>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-3">
      <p className="text-2xl font-semibold text-[#4f46e5]">{value}</p>
      <p className="mt-1 text-xs font-semibold text-[#667085]">{label}</p>
    </div>
  );
}

function DataBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-3">
      <p className="text-xs font-semibold text-[#667085]">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function InfoLine({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-[#fbfcfd] p-3">
      <Icon className="h-4 w-4 text-[#667085]" />
      <div>
        <p className="text-xs font-semibold text-[#667085]">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "APPROVED"
      ? "bg-[#e0f2fe] text-[#0284c7]"
      : status === "REJECTED" || status === "CANCELLED"
        ? "bg-[#fff1f3] text-[#d92d20]"
        : "bg-[#fff7e6] text-[#b26b00]";

  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${className}`}>{requestStatusLabel(status)}</span>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function requestStatusLabel(status: string) {
  const labels: Record<string, string> = {
    APPROVED: "Aprobada",
    CANCELLED: "Cancelada",
    PENDING: "Pendiente",
    REJECTED: "Rechazada",
  };

  return labels[status] ?? status;
}

function requestTypeLabel(type: string) {
  const labels: Record<string, string> = {
    MEDICAL_LEAVE: "Descanso medico",
    OTHER: "Otro",
    PERMISSION: "Permiso",
    REMOTE_WORK: "Trabajo remoto",
    VACATION: "Vacaciones",
  };

  return labels[type] ?? type;
}

function documentStatusLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: "Borrador",
    EXPIRED: "Vencido",
    PENDING_SIGNATURE: "Pendiente de firma",
    SIGNED: "Firmado",
  };

  return labels[status] ?? status;
}

function documentTypeLabel(type: string) {
  const labels: Record<string, string> = {
    CERTIFICATE: "Certificado",
    CONTRACT: "Contrato",
    OTHER: "Otro",
    PAYSLIP: "Boleta",
    POLICY: "Politica",
  };

  return labels[type] ?? type;
}
