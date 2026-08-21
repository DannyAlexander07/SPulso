import type { AttendanceRecord } from "@/features/attendance/types";
import { mediaUrl } from "@/lib/api";
import { Check, Clock3, MapPin } from "lucide-react";

export function AttendanceSuccessCard({
  action,
  avatarUrl,
  locationLabel,
  record,
}: {
  action: "CHECK_IN" | "CHECK_OUT";
  avatarUrl?: string | null;
  locationLabel: string;
  record: AttendanceRecord;
}) {
  const fullName = `${record.employee.firstName} ${record.employee.lastName}`;
  const markTime = action === "CHECK_IN" ? record.checkIn : record.checkOut;

  return (
    <div className="overflow-hidden rounded-[26px] border border-[#bbf7d0] bg-[#f0fdf4] p-4 shadow-[0_22px_50px_rgba(22,163,74,0.16)]">
      <div className="flex items-center gap-4">
        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center">
          <span className="absolute h-20 w-20 animate-ping rounded-full bg-[#22c55e]/20" />
          <span className="absolute h-16 w-16 rounded-full border-4 border-[#bbf7d0]" />
          <span className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-white text-sm font-bold text-[#15803d] shadow-lg">
            {avatarUrl ? (
              <img alt={fullName} className="h-full w-full object-cover" src={mediaUrl(avatarUrl)} />
            ) : (
              initials(record.employee.firstName, record.employee.lastName)
            )}
          </span>
          <span className="absolute -right-1 bottom-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#16a34a] text-white shadow-lg">
            <Check className="h-4 w-4" />
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#15803d]">Marcacion confirmada</p>
          <h3 className="mt-1 whitespace-normal break-words text-xl font-semibold leading-6 text-[#14532d]">
            Hola, {record.employee.firstName}.
          </h3>
          <p className="mt-1 text-sm leading-5 text-[#166534]">
            Tu {action === "CHECK_IN" ? "entrada" : "salida"} quedo registrada correctamente.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div className="rounded-2xl bg-white/80 px-3 py-2">
          <p className="flex items-center gap-2 text-xs font-semibold text-[#15803d]">
            <Clock3 className="h-4 w-4" />
            Hora registrada
          </p>
          <p className="mt-1 text-lg font-bold text-[#14532d]">{formatTime(markTime)}</p>
        </div>
        <div className="rounded-2xl bg-white/80 px-3 py-2">
          <p className="flex items-center gap-2 text-xs font-semibold text-[#15803d]">
            <MapPin className="h-4 w-4" />
            Lugar
          </p>
          <p className="mt-1 whitespace-normal break-words text-sm font-bold leading-5 text-[#14532d]">{locationLabel}</p>
        </div>
      </div>
    </div>
  );
}

function initials(firstName: string, lastName: string) {
  return `${firstName.slice(0, 1)}${lastName.slice(0, 1)}`.toUpperCase();
}

function formatTime(value: string | null) {
  if (!value) {
    return "Pendiente";
  }

  return new Intl.DateTimeFormat("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}
