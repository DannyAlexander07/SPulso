"use client";

import { CalendarDays } from "lucide-react";
import { useRouter } from "next/navigation";

export function AttendanceDateFilter({ selectedDate }: { selectedDate: string }) {
  const router = useRouter();

  function handleChange(value: string) {
    router.push(value ? `/asistencia?fecha=${value}` : "/asistencia");
  }

  return (
    <label className="flex h-10 items-center gap-2 rounded-xl border border-[#e1e5eb] bg-white px-3 text-sm text-[#475467] shadow-sm">
      <CalendarDays className="h-4 w-4 text-[#4f46e5]" />
      <span className="hidden font-semibold sm:inline">Fecha</span>
      <input autoComplete="off"
        className="bg-transparent text-sm font-semibold outline-none"
        defaultValue={selectedDate}
        max={todayInputValue()}
        onChange={(event) => handleChange(event.target.value)}
        type="date"
      />
    </label>
  );
}

function todayInputValue() {
  const today = new Date();
  const offset = today.getTimezoneOffset();
  const localToday = new Date(today.getTime() - offset * 60 * 1000);

  return localToday.toISOString().slice(0, 10);
}
