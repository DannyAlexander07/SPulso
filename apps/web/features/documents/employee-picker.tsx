"use client";

import { getEmployeesPage } from "@/features/employees/api";
import type { Employee } from "@/features/employees/types";
import { Check, ChevronDown, Loader2, Search, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type EmployeePickerProps = {
  initialEmployees: Employee[];
  label?: string;
  multiple?: boolean;
  name: string;
  onChange?: (employeeIds: string[]) => void;
  placeholder?: string;
  selectedIds: string[];
};

export function EmployeePicker({
  initialEmployees,
  label = "Trabajadores",
  multiple = false,
  name,
  onChange,
  placeholder = "Seleccionar trabajadores",
  selectedIds,
}: EmployeePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState(initialEmployees);
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "loadingMore" | "error">("idle");
  const [knownEmployees, setKnownEmployees] = useState<Record<string, Employee>>(() =>
    Object.fromEntries(initialEmployees.map((employee) => [employee.id, employee])),
  );

  useEffect(() => {
    setItems(initialEmployees);
    setKnownEmployees((current) => ({
      ...current,
      ...Object.fromEntries(initialEmployees.map((employee) => [employee.id, employee])),
    }));
  }, [initialEmployees]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void loadEmployees({ nextCursor: null, query: search, reset: true });
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [isOpen, search]);

  const selectedEmployees = useMemo(
    () => selectedIds.map((id) => knownEmployees[id]).filter(Boolean),
    [knownEmployees, selectedIds],
  );

  const buttonLabel =
    selectedEmployees.length === 0
      ? placeholder
      : selectedEmployees.length === 1
        ? `${selectedEmployees[0].firstName} ${selectedEmployees[0].lastName}`
        : `${selectedEmployees.length} trabajadores seleccionados`;

  async function loadEmployees({
    nextCursor,
    query,
    reset,
  }: {
    nextCursor: string | null;
    query: string;
    reset: boolean;
  }) {
    setState(reset ? "loading" : "loadingMore");

    try {
      const result = await getEmployeesPage({
        cursor: nextCursor ?? undefined,
        pageSize: 20,
        search: query.trim() || undefined,
        status: "ACTIVE",
      });

      setItems((current) => (reset ? result.data : [...current, ...result.data]));
      setCursor(result.meta.nextCursor);
      setHasNextPage(result.meta.hasNextPage);
      setKnownEmployees((current) => ({
        ...current,
        ...Object.fromEntries(result.data.map((employee) => [employee.id, employee])),
      }));
      setState("idle");
    } catch {
      setState("error");
    }
  }

  function toggleEmployee(employee: Employee) {
    const nextIds = selectedIds.includes(employee.id)
      ? selectedIds.filter((id) => id !== employee.id)
      : multiple
        ? [...selectedIds, employee.id]
        : [employee.id];

    setKnownEmployees((current) => ({ ...current, [employee.id]: employee }));
    onChange?.(nextIds);

    if (!multiple) {
      setIsOpen(false);
    }
  }

  return (
    <div className="space-y-1.5">
      {label ? <span className="text-xs font-semibold text-[#667085]">{label}</span> : null}
      {selectedIds.map((employeeId) => (
        <input key={employeeId} name={name} type="hidden" value={employeeId} />
      ))}
      <button
        aria-expanded={isOpen}
        className="flex h-11 w-full items-center justify-between gap-3 rounded-xl border border-[#d8dee8] bg-white px-3 text-left text-sm outline-none transition hover:border-[#a5b4fc] focus:border-[#4f46e5] focus:ring-4 focus:ring-[#c7d2fe]"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Users className="h-4 w-4 shrink-0 text-[#667085]" />
          <span className={`truncate ${selectedEmployees.length ? "text-[#1f242d]" : "text-[#98a2b3]"}`}>
            {buttonLabel}
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-[#667085] transition ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#111827]/20 px-4 py-6">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#d8dee8] bg-white shadow-[0_28px_80px_rgba(16,24,40,0.28)]">
            <div className="flex items-start justify-between gap-4 border-b border-[#edf0f5] px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">
                  Asignacion
                </p>
                <h4 className="mt-1 text-lg font-semibold text-[#1f242d]">
                  Elegir trabajadores
                </h4>
              </div>
              <button
                aria-label="Cerrar selector"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#e1e5eb] text-[#667085] transition hover:border-[#4f46e5] hover:text-[#4f46e5]"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98a2b3]" />
                <input
                  className="h-11 w-full rounded-xl border border-[#d8dee8] bg-[#fbfcfd] pl-9 pr-3 text-sm outline-none transition placeholder:text-[#98a2b3] focus:border-[#4f46e5] focus:bg-white focus:ring-4 focus:ring-[#c7d2fe]"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por nombre, DNI, codigo o empresa"
                  type="search"
                  value={search}
                />
              </div>
              <div className="mt-3 max-h-[min(420px,48dvh)] overflow-y-auto rounded-2xl border border-[#edf0f5] bg-[#fbfcfd] p-1.5">
                {state === "loading" ? (
                  <div className="flex items-center justify-center gap-2 px-3 py-8 text-sm font-semibold text-[#667085]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Buscando trabajadores...
                  </div>
                ) : items.length > 0 ? (
                  items.map((employee) => {
                    const isSelected = selectedIds.includes(employee.id);

                    return (
                      <button
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                          isSelected ? "bg-[#eef2ff] text-[#3730a3]" : "text-[#344054] hover:bg-white"
                        }`}
                        key={employee.id}
                        onClick={() => toggleEmployee(employee)}
                        type="button"
                      >
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                          isSelected ? "border-[#4f46e5] bg-[#4f46e5] text-white" : "border-[#cbd5e1] bg-white"
                        }`}>
                          {isSelected ? <Check className="h-3.5 w-3.5" /> : null}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">
                            {employee.firstName} {employee.lastName}
                          </span>
                          <span className="block truncate text-xs text-[#667085]">
                            {employee.company.name}
                            {employee.jobTitle ? ` · ${employee.jobTitle}` : ""}
                          </span>
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <p className="px-3 py-8 text-center text-sm font-medium text-[#667085]">
                    No hay trabajadores con ese filtro.
                  </p>
                )}
              </div>
              {state === "error" ? (
                <p className="mt-2 text-sm font-semibold text-[#b42318]">
                  No se pudo cargar la lista. Intenta nuevamente.
                </p>
              ) : null}
              <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-semibold text-[#667085]">
                  {selectedIds.length} seleccionado{selectedIds.length === 1 ? "" : "s"}
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  {hasNextPage ? (
                    <button
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#d8dee8] bg-white px-4 text-sm font-semibold text-[#475467] transition hover:border-[#4f46e5] hover:text-[#4f46e5] disabled:opacity-60"
                      disabled={state === "loadingMore"}
                      onClick={() => loadEmployees({ nextCursor: cursor, query: search, reset: false })}
                      type="button"
                    >
                      {state === "loadingMore" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Cargar mas
                    </button>
                  ) : null}
                  <button
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-[#4f46e5] px-4 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(79,70,229,0.22)] transition hover:bg-[#4338ca]"
                    onClick={() => setIsOpen(false)}
                    type="button"
                  >
                    Aplicar seleccion
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
