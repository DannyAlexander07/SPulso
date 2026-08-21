"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";
import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { updateAttendanceRules } from "./api";
import type { Company } from "./types";

type FormState = "idle" | "loading" | "success" | "error";

export function AttendanceRulesForm({ company }: { company: Company }) {
  const router = useRouter();
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const data = new FormData(form);

    setState("loading");
    setMessage("");

    try {
      await updateAttendanceRules(company.id, {
        workStartTime: String(data.get("workStartTime") ?? ""),
        lateToleranceMinutes: Number(data.get("lateToleranceMinutes") ?? 0),
        enforceAttendanceGeofence: data.get("enforceAttendanceGeofence") === "on",
        officeLatitude: optionalNumber(data.get("officeLatitude")),
        officeLongitude: optionalNumber(data.get("officeLongitude")),
        attendanceRadiusMeters: Number(data.get("attendanceRadiusMeters") ?? 200),
      });

      setState("success");
      setMessage("Regla actualizada.");
      router.refresh();

      window.setTimeout(() => {
        setState("idle");
        setMessage("");
      }, 2200);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar.");
    }
  }

  return (
    <form autoComplete="off" className="mt-3 space-y-2" onSubmit={handleSubmit}>
      <p className="rounded-xl bg-[#f8fafc] px-3 py-2 text-[11px] font-medium leading-4 text-[#667085]">
        Aplica a proximas marcaciones. Los registros ya creados no se recalculan automaticamente.
      </p>

      <div className="grid grid-cols-[1fr_88px] gap-2">
        <label className="space-y-1">
          <span className="text-[11px] font-semibold text-[#667085]">Entrada</span>
          <input autoComplete="off"
            className={inputClassName}
            defaultValue={company.workStartTime}
            name="workStartTime"
            required
            type="time"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-semibold text-[#667085]">Tol.</span>
          <input autoComplete="off"
            className={inputClassName}
            defaultValue={company.lateToleranceMinutes}
            max={180}
            min={0}
            name="lateToleranceMinutes"
            required
            type="number"
          />
        </label>
      </div>

      <label className="flex items-center gap-2 rounded-xl border border-[#d8dee8] bg-white px-3 py-2 text-[11px] font-semibold text-[#344054]">
        <input
          defaultChecked={company.enforceAttendanceGeofence}
          name="enforceAttendanceGeofence"
          type="checkbox"
        />
        Exigir que la marcacion se realice dentro de la zona autorizada
      </label>

      <div className="grid grid-cols-3 gap-2">
        <label className="space-y-1">
          <span className="text-[11px] font-semibold text-[#667085]">Latitud</span>
          <input
            className={inputClassName}
            defaultValue={company.officeLatitude ?? ""}
            max={90}
            min={-90}
            name="officeLatitude"
            placeholder="-12.0464"
            step="any"
            type="number"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-semibold text-[#667085]">Longitud</span>
          <input
            className={inputClassName}
            defaultValue={company.officeLongitude ?? ""}
            max={180}
            min={-180}
            name="officeLongitude"
            placeholder="-77.0428"
            step="any"
            type="number"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-semibold text-[#667085]">Radio (m)</span>
          <input
            className={inputClassName}
            defaultValue={company.attendanceRadiusMeters}
            max={5000}
            min={25}
            name="attendanceRadiusMeters"
            required
            type="number"
          />
        </label>
      </div>

      <button
        className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-[#eef2ff] px-3 text-xs font-bold text-[#4f46e5] transition hover:bg-[#c7d2fe] disabled:opacity-70"
        disabled={state === "loading"}
        type="submit"
      >
        <Save className="h-3.5 w-3.5" />
        {state === "loading" ? "Guardando..." : "Guardar regla"}
      </button>

      {state !== "idle" ? (
        <ActionFeedback
          message={state === "loading" ? "Actualizando regla..." : message}
          tone={state === "error" ? "error" : state === "success" ? "success" : "loading"}
        />
      ) : null}
    </form>
  );
}

const inputClassName =
  "h-9 w-full rounded-xl border border-[#d8dee8] bg-white px-2 text-xs font-semibold outline-none transition focus:border-[#4f46e5] focus:ring-4 focus:ring-[#c7d2fe]";

function optionalNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  return Number(value);
}
