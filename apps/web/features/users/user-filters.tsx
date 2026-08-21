"use client";

import Link from "next/link";
import { Filter, RotateCcw, Search } from "lucide-react";
import type { Company } from "@/features/companies/types";
import type { AppRole, UserFilters } from "./types";

const statusOptions = [
  { label: "Todos los estados", value: "" },
  { label: "Activos", value: "ACTIVE" },
  { label: "Invitados", value: "INVITED" },
  { label: "Inactivos", value: "INACTIVE" },
];

export function UserFiltersForm({
  companies,
  filters,
  roles,
}: {
  companies: Company[];
  filters: UserFilters;
  roles: AppRole[];
}) {
  return (
    <form autoComplete="off"
      action="/usuarios"
      className="spulso-filter-grid"
    >
      <input autoComplete="off" name="pagina" type="hidden" value="1" />
      <label className="flex h-10 min-w-0 items-center gap-2 rounded-[13px] border border-[#dfe5ec] bg-white px-3 text-sm text-[#475467] transition focus-within:border-[#4f46e5] focus-within:ring-4 focus-within:ring-[#4f46e5]/10">
        <Search className="h-4 w-4 shrink-0 text-[#98a2b3]" />
        <input autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#98a2b3]"
          defaultValue={filters.search ?? ""}
          name="buscar"
          placeholder="Buscar nombre, correo, rol o empresa"
        />
      </label>

      <select
        className={selectClassName}
        defaultValue={filters.roleId ?? ""}
        name="rol"
      >
        <option value="">Todos los roles</option>
        {roles.map((role) => (
          <option key={role.id} value={role.id}>
            {role.name}
          </option>
        ))}
      </select>

      <select
        className={selectClassName}
        defaultValue={filters.companyId ?? ""}
        name="empresa"
      >
        <option value="">Todas las empresas</option>
        {companies.map((company) => (
          <option key={company.id} value={company.id}>
            {company.name}
          </option>
        ))}
      </select>

      <select
        className={selectClassName}
        defaultValue={filters.status ?? ""}
        name="estado"
      >
        {statusOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <select
        className={selectClassName}
        defaultValue={filters.pageSize ?? 10}
        name="porPagina"
      >
        <option value="10">10 por pag.</option>
        <option value="20">20 por pag.</option>
        <option value="50">50 por pag.</option>
      </select>

      <button
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-[13px] bg-[#4f46e5] px-4 text-sm font-semibold text-white shadow-sm shadow-[#4f46e5]/20 transition hover:-translate-y-0.5 hover:bg-[#4338ca]"
        type="submit"
      >
        <Filter className="h-4 w-4" />
        Filtrar
      </button>

      <Link
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-[13px] border border-[#dfe5ec] bg-white px-4 text-sm font-semibold text-[#475467] transition hover:border-[#4f46e5] hover:bg-[#eef2ff] hover:text-[#4f46e5]"
        href="/usuarios"
      >
        <RotateCcw className="h-4 w-4" />
        Limpiar
      </Link>
    </form>
  );
}

const selectClassName =
  "h-10 min-w-0 rounded-[13px] border border-[#dfe5ec] bg-white px-3 text-sm font-semibold text-[#475467] outline-none transition hover:border-[#c8d2e0] focus:border-[#4f46e5] focus:ring-4 focus:ring-[#4f46e5]/10";
