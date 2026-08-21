"use client";

import Link from "next/link";
import { Filter, RotateCcw, Search } from "lucide-react";
import type { CompanyFilters } from "./types";

const statusOptions = [
  { label: "Todos los estados", value: "" },
  { label: "Activas", value: "ACTIVE" },
  { label: "Inactivas", value: "INACTIVE" },
];

export function CompanyFiltersForm({ filters }: { filters: CompanyFilters }) {
  return (
    <form autoComplete="off"
      action="/empresas"
      className="spulso-filter-grid"
    >
      <label className="flex h-11 min-w-0 items-center gap-2 rounded-xl border border-[#e1e5eb] bg-white px-3 text-sm text-[#475467]">
        <Search className="h-4 w-4 shrink-0 text-[#98a2b3]" />
        <input autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#98a2b3]"
          defaultValue={filters.search ?? ""}
          name="buscar"
          placeholder="Buscar por empresa, RUC o identificador"
        />
      </label>

      <select
        className="h-11 min-w-0 rounded-xl border border-[#e1e5eb] bg-white px-3 text-sm font-semibold text-[#475467] outline-none transition focus:border-[#4f46e5]"
        defaultValue={filters.status ?? ""}
        name="estado"
      >
        {statusOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
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
        href="/empresas"
      >
        <RotateCcw className="h-4 w-4" />
        Limpiar
      </Link>
    </form>
  );
}
