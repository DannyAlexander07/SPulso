"use client";

import { CalendarRange, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AttendanceRangeFilter({
  from,
  to,
}: {
  from: string;
  to: string;
}) {
  const router = useRouter();
  const [startDate, setStartDate] = useState(from);
  const [endDate, setEndDate] = useState(to);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    router.push(`/asistencia/reporte?desde=${startDate}&hasta=${endDate}`);
  }

  return (
    <form autoComplete="off"
      className="grid animate-rise gap-3 rounded-2xl border border-[#e1e5eb] bg-white p-4 shadow-sm sm:grid-cols-2"
      onSubmit={handleSubmit}
    >
      <div className="sm:col-span-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-[#344054]">
          <CalendarRange className="h-4 w-4 text-[#4f46e5]" />
          Periodo del reporte
        </p>
        <p className="mt-1 text-xs text-[#667085]">Consulta hasta 90 dias por busqueda.</p>
      </div>
      <label className="grid gap-1.5 text-xs font-semibold text-[#667085]">
        Desde
        <input autoComplete="off"
          className="h-10 w-full min-w-0 rounded-xl border border-[#e1e5eb] bg-white px-3 text-sm font-semibold text-[#1f242d] outline-none transition focus:border-[#4f46e5]"
          max={endDate}
          onChange={(event) => setStartDate(event.target.value)}
          required
          type="date"
          value={startDate}
        />
      </label>
      <label className="grid gap-1.5 text-xs font-semibold text-[#667085]">
        Hasta
        <input autoComplete="off"
          className="h-10 w-full min-w-0 rounded-xl border border-[#e1e5eb] bg-white px-3 text-sm font-semibold text-[#1f242d] outline-none transition focus:border-[#4f46e5]"
          min={startDate}
          onChange={(event) => setEndDate(event.target.value)}
          required
          type="date"
          value={endDate}
        />
      </label>
      <button
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#4f46e5] px-4 text-sm font-semibold text-white shadow-sm shadow-[#4f46e5]/20 transition hover:-translate-y-0.5 hover:bg-[#4338ca] sm:col-span-2"
        type="submit"
      >
        <Search className="h-4 w-4" />
        Aplicar fechas
      </button>
    </form>
  );
}
