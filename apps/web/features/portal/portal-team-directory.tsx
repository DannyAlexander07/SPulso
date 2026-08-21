"use client";

import { Mail, Phone, Search, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { PortalAvatar, PortalEmpty } from "./portal-shell";
import type { PortalProfile } from "./types";

type TeamMember = PortalProfile["teamMembers"][number];

export function PortalTeamDirectory({ members }: { members: TeamMember[] }) {
  const [query, setQuery] = useState("");

  const filteredMembers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return members;
    }

    return members.filter((member) => {
      const text = [
        member.firstName,
        member.lastName,
        member.position?.name,
        member.jobTitle,
        member.areaRef?.name,
        member.company.name,
        member.personalEmail,
        member.phoneMobile,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(normalizedQuery);
    });
  }, [members, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef2ff] text-[#4f46e5]">
            <UsersRound className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">Directorio del equipo</p>
            <p className="text-xs text-[#667085]">{members.length} companeros asignados</p>
          </div>
        </div>
        <label className="flex h-11 min-w-0 items-center gap-2 rounded-xl border border-[#d8dee8] bg-white px-3 sm:w-80">
          <Search className="h-4 w-4 shrink-0 text-[#98a2b3]" />
          <input autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#98a2b3]"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nombre, cargo o area"
            type="search"
            value={query}
          />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {filteredMembers.map((member) => (
          <TeamMemberCard key={member.id} member={member} />
        ))}
      </div>

      {members.length === 0 ? <PortalEmpty text="Aun no tienes companeros asignados en este equipo." /> : null}
      {members.length > 0 && filteredMembers.length === 0 ? <PortalEmpty text="No encontramos companeros con ese filtro." /> : null}
    </div>
  );
}

function TeamMemberCard({ member }: { member: TeamMember }) {
  const fullName = `${member.firstName} ${member.lastName}`;
  const role = member.position?.name ?? member.jobTitle ?? "Sin cargo asignado";

  return (
    <article className="flex min-h-[118px] flex-col justify-between rounded-2xl border border-[#e1e5eb] bg-white p-3 transition hover:border-[#818cf8] hover:shadow-sm">
      <div className="flex items-start gap-3">
        <PortalAvatar firstName={member.firstName} lastName={member.lastName} />
        <div className="min-w-0 flex-1">
          <p className="whitespace-normal break-words text-sm font-semibold leading-5">{fullName}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-4 text-[#667085]">{role}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-[#f2f4f7] px-2.5 py-1 text-[11px] font-semibold text-[#667085]">
              {member.areaRef?.name ?? "Sin area"}
            </span>
            <span className="rounded-full bg-[#eef2ff] px-2.5 py-1 text-[11px] font-semibold text-[#4f46e5]">
              {member.company.name}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        {member.personalEmail ? (
          <a
            className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-xl bg-[#eef2ff] px-3 text-xs font-bold text-[#4f46e5] transition hover:bg-[#c7d2fe]"
            href={`mailto:${member.personalEmail}`}
          >
            <Mail className="h-4 w-4" />
            Correo
          </a>
        ) : null}
        {member.phoneMobile ? (
          <a
            className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-xl bg-[#f2f4f7] px-3 text-xs font-bold text-[#475467] transition hover:bg-[#e4e7ec]"
            href={`tel:${member.phoneMobile}`}
          >
            <Phone className="h-4 w-4" />
            Llamar
          </a>
        ) : null}
        {!member.personalEmail && !member.phoneMobile ? (
          <span className="inline-flex h-9 flex-1 items-center justify-center rounded-xl bg-[#f2f4f7] px-3 text-xs font-semibold text-[#667085]">
            Sin contacto visible
          </span>
        ) : null}
      </div>
    </article>
  );
}
