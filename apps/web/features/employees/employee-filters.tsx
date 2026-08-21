"use client";

import { Filter, RotateCcw, Search } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import type { Company } from "@/features/companies/types";
import type { EmployeeFilters } from "./types";

const statusOptions = [
  { label: "Todos los estados", value: "" },
  { label: "Activos", value: "ACTIVE" },
  { label: "Inactivos", value: "INACTIVE" },
  { label: "Cesados", value: "TERMINATED" },
];

export function EmployeeFiltersForm({
  companies,
  filters,
}: {
  companies: Company[];
  filters: EmployeeFilters;
}) {
  return (
    <form autoComplete="off"
      action="/trabajadores"
      className="spulso-filter-grid"
    >
      <input autoComplete="off" name="pagina" type="hidden" value="1" />
      <TextField
        defaultValue={filters.search ?? ""}
        icon={Search}
        name="buscar"
        placeholder="Buscar nombre, DNI, codigo, cargo o area"
      />

      <SelectField
        defaultValue={filters.companyId ?? ""}
        name="empresa"
      >
        <option value="">Todas las empresas</option>
        {companies.map((company) => (
          <option key={company.id} value={company.id}>
            {company.name}
          </option>
        ))}
      </SelectField>

      <SelectField
        defaultValue={filters.status ?? ""}
        name="estado"
      >
        {statusOptions.map((option) => (
          <option key={option.value} value={option.value}>
          {option.label}
          </option>
        ))}
      </SelectField>

      <SelectField
        defaultValue={filters.pageSize ?? 10}
        name="porPagina"
      >
        <option value="10">10 por pag.</option>
        <option value="20">20 por pag.</option>
        <option value="50">50 por pag.</option>
      </SelectField>

      <Button
        icon={Filter}
        size="md"
        type="submit"
      >
        Filtrar
      </Button>

      <LinkButton
        href="/trabajadores"
        icon={RotateCcw}
        size="md"
        variant="secondary"
      >
        Limpiar
      </LinkButton>
    </form>
  );
}
