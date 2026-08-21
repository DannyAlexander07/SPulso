"use client";

import Link from "next/link";
import { Filter, RotateCcw, Search } from "lucide-react";
import { useState } from "react";
import type { Company } from "@/features/companies/types";
import type { Employee } from "@/features/employees/types";
import { EmployeePicker } from "./employee-picker";
import type { DocumentFilters, DocumentFolder } from "./types";

const statusOptions = [
  { label: "Todos los estados", value: "" },
  { label: "Borradores", value: "DRAFT" },
  { label: "Pendientes de firma", value: "PENDING_SIGNATURE" },
  { label: "Firmados", value: "SIGNED" },
  { label: "Vencidos", value: "EXPIRED" },
];

const typeOptions = [
  { label: "Todos los tipos", value: "" },
  { label: "Contrato", value: "CONTRACT" },
  { label: "Boleta", value: "PAYSLIP" },
  { label: "Politica", value: "POLICY" },
  { label: "Certificado", value: "CERTIFICATE" },
  { label: "Otro", value: "OTHER" },
];

export function DocumentFiltersForm({
  companies,
  employees,
  filters,
  folders,
}: {
  companies: Company[];
  employees: Employee[];
  filters: DocumentFilters;
  folders: DocumentFolder[];
}) {
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>(
    filters.employeeId ? [filters.employeeId] : [],
  );

  return (
    <form autoComplete="off"
      action="/documentos"
      className="spulso-filter-grid"
    >
      <input autoComplete="off" name="pagina" type="hidden" value="1" />
      <input
        name="vista"
        type="hidden"
        value={filters.view === "folder" ? "carpeta" : "trabajador"}
      />
      <label className="flex h-11 min-w-0 items-center gap-2 rounded-xl border border-[#e1e5eb] bg-white px-3 text-sm text-[#475467]">
        <Search className="h-4 w-4 shrink-0 text-[#98a2b3]" />
        <input autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#98a2b3]"
          defaultValue={filters.search ?? ""}
          name="buscar"
          placeholder="Buscar por documento, trabajador o empresa"
        />
      </label>

      <select
        className="h-11 min-w-0 rounded-xl border border-[#e1e5eb] bg-white px-3 text-sm font-semibold text-[#475467] outline-none transition placeholder:text-[#98a2b3] focus:border-[#4f46e5]"
        defaultValue={filters.folderId ?? ""}
        name="carpeta"
      >
        <option value="">Todas las carpetas</option>
        {folders.map((folder) => (
          <option key={folder.id} value={folder.id}>
            {folder.name}
          </option>
        ))}
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

      <EmployeePicker
        initialEmployees={employees}
        label=""
        name="trabajador"
        onChange={setSelectedEmployeeIds}
        placeholder="Todos los trabajadores"
        selectedIds={selectedEmployeeIds}
      />

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
        href="/documentos?vista=trabajador"
      >
        <RotateCcw className="h-4 w-4" />
        Limpiar
      </Link>
    </form>
  );
}
