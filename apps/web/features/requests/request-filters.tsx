"use client";

import Link from "next/link";
import { Filter, RotateCcw, Search } from "lucide-react";
import type { Company } from "@/features/companies/types";
import type { Employee } from "@/features/employees/types";
import type { RequestFilters } from "./types";

const statusOptions = [
  { label: "Todos los estados", value: "" },
  { label: "Pendientes", value: "PENDING" },
  { label: "Aprobadas", value: "APPROVED" },
  { label: "Rechazadas", value: "REJECTED" },
  { label: "Canceladas", value: "CANCELLED" },
];

const typeOptions = [
  { label: "Todos los tipos", value: "" },
  { label: "Vacaciones", value: "VACATION" },
  { label: "Permiso", value: "PERMISSION" },
  { label: "Trabajo remoto", value: "REMOTE_WORK" },
  { label: "Descanso medico", value: "MEDICAL_LEAVE" },
  { label: "Otro", value: "OTHER" },
];

export function RequestFiltersForm({
  companies,
  employees,
  filters,
}: {
  companies: Company[];
  employees: Employee[];
  filters: RequestFilters;
}) {
  return (
    <form autoComplete="off"
      action="/solicitudes"
      className="spulso-filter-grid"
    >
      <input autoComplete="off" name="pagina" type="hidden" value="1" />
      <label className="flex h-11 min-w-0 items-center gap-2 rounded-xl border border-[#e1e5eb] bg-white px-3 text-sm text-[#475467]">
        <Search className="h-4 w-4 shrink-0 text-[#98a2b3]" />
        <input autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#98a2b3]"
          defaultValue={filters.search ?? ""}
          name="buscar"
          placeholder="Buscar por trabajador, empresa o solicitud"
        />
      </label>

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

      <select
        className="h-11 min-w-0 rounded-xl border border-[#e1e5eb] bg-white px-3 text-sm font-semibold text-[#475467] outline-none transition focus:border-[#4f46e5]"
        defaultValue={filters.employeeId ?? ""}
        name="trabajador"
      >
        <option value="">Todos los trabajadores</option>
        {employees.map((employee) => (
          <option key={employee.id} value={employee.id}>
            {employee.firstName} {employee.lastName}
          </option>
        ))}
      </select>

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

      <select
        className="h-11 min-w-0 rounded-xl border border-[#e1e5eb] bg-white px-3 text-sm font-semibold text-[#475467] outline-none transition focus:border-[#4f46e5]"
        defaultValue={filters.pageSize ?? 10}
        name="porPagina"
      >
        <option value="10">10 por pag.</option>
        <option value="20">20 por pag.</option>
        <option value="50">50 por pag.</option>
      </select>

      <select
        className="h-11 min-w-0 rounded-xl border border-[#e1e5eb] bg-white px-3 text-sm font-semibold text-[#475467] outline-none transition focus:border-[#4f46e5]"
        defaultValue={filters.type ?? ""}
        name="tipo"
      >
        {typeOptions.map((option) => (
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
        href="/solicitudes"
      >
        <RotateCcw className="h-4 w-4" />
        Limpiar
      </Link>
    </form>
  );
}
