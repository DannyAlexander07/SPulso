"use client";

import Link from "next/link";
import { Filter, RotateCcw, Search } from "lucide-react";
import type { Company } from "@/features/companies/types";
import type { AuditFilters } from "./types";

const actorOptions = [
  { label: "Todos los actores", value: "" },
  { label: "Sistema", value: "system" },
  { label: "Usuario", value: "user" },
  { label: "Trabajador", value: "worker" },
];

export function AuditFiltersForm({
  companies,
  filters,
}: {
  companies: Company[];
  filters: AuditFilters;
}) {
  return (
    <form autoComplete="off"
      action="/auditoria"
      className="spulso-filter-grid"
    >
      <input autoComplete="off" name="pagina" type="hidden" value="1" />
      <label className="flex h-11 min-w-0 items-center gap-2 rounded-xl border border-[#e1e5eb] bg-white px-3 text-sm text-[#475467]">
        <Search className="h-4 w-4 shrink-0 text-[#98a2b3]" />
        <input autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#98a2b3]"
          defaultValue={filters.search ?? ""}
          name="buscar"
          placeholder="Buscar actor, empresa, accion o resumen"
        />
      </label>

      <select
        className="h-11 min-w-0 rounded-xl border border-[#e1e5eb] bg-white px-3 text-sm font-semibold text-[#475467] outline-none transition focus:border-[#4f46e5]"
        defaultValue={filters.actorType ?? ""}
        name="actor"
      >
        {actorOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <label className="flex h-11 min-w-0 items-center gap-2 rounded-xl border border-[#e1e5eb] bg-white px-3 text-sm font-semibold text-[#475467]">
        <span className="text-xs text-[#667085]">Desde</span>
        <input autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          defaultValue={filters.from ?? ""}
          name="desde"
          type="date"
        />
      </label>

      <label className="flex h-11 min-w-0 items-center gap-2 rounded-xl border border-[#e1e5eb] bg-white px-3 text-sm font-semibold text-[#475467]">
        <span className="text-xs text-[#667085]">Hasta</span>
        <input autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          defaultValue={filters.to ?? ""}
          name="hasta"
          type="date"
        />
      </label>

      <select
        className="h-11 min-w-0 rounded-xl border border-[#e1e5eb] bg-white px-3 text-sm font-semibold text-[#475467] outline-none transition focus:border-[#4f46e5]"
        defaultValue={filters.pageSize ?? 20}
        name="porPagina"
      >
        <option value="20">20 por pag.</option>
        <option value="50">50 por pag.</option>
        <option value="100">100 por pag.</option>
      </select>

      <select
        className="h-11 min-w-0 rounded-xl border border-[#e1e5eb] bg-white px-3 text-sm font-semibold text-[#475467] outline-none transition focus:border-[#4f46e5]"
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

      <button
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#4f46e5] px-4 text-sm font-semibold text-white shadow-sm shadow-[#4f46e5]/20 transition hover:-translate-y-0.5 hover:bg-[#4338ca]"
        type="submit"
      >
        <Filter className="h-4 w-4" />
        Filtrar
      </button>

      <Link
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#e1e5eb] bg-white px-4 text-sm font-semibold text-[#475467] transition hover:border-[#4f46e5] hover:text-[#4f46e5]"
        href="/auditoria"
      >
        <RotateCcw className="h-4 w-4" />
        Limpiar
      </Link>
    </form>
  );
}
