"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";
import { KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { updateAttendancePin } from "./api";

type FormState = "idle" | "loading" | "success" | "error";

export function AttendancePinForm({ employeeId }: { employeeId: string }) {
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
      await updateAttendancePin(employeeId, {
        attendancePin: String(data.get("attendancePin") ?? ""),
      });

      form.reset();
      setState("success");
      setMessage("PIN actualizado.");
      router.refresh();

      window.setTimeout(() => {
        setState("idle");
        setMessage("");
      }, 2200);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar el PIN.");
    }
  }

  return (
    <form autoComplete="off" className="flex min-w-[210px] flex-col gap-2" onSubmit={handleSubmit}>
      <div className="flex gap-2">
        <input autoComplete="off"
          className="h-9 w-24 rounded-xl border border-[#d8dee8] bg-white px-2 text-xs font-semibold outline-none transition placeholder:text-[#98a2b3] focus:border-[#4f46e5] focus:ring-4 focus:ring-[#c7d2fe]"
          inputMode="numeric"
          maxLength={8}
          minLength={4}
          name="attendancePin"
          placeholder="Nuevo PIN"
          required
          type="password"
        />
        <button
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-[#eef2ff] px-3 text-xs font-bold text-[#4f46e5] transition hover:bg-[#c7d2fe] disabled:opacity-70"
          disabled={state === "loading"}
          type="submit"
        >
          <KeyRound className="h-3.5 w-3.5" />
          {state === "loading" ? "..." : "Cambiar"}
        </button>
      </div>
      {state !== "idle" ? (
        <ActionFeedback
          message={state === "loading" ? "Actualizando PIN..." : message}
          tone={state === "error" ? "error" : state === "success" ? "success" : "loading"}
        />
      ) : null}
    </form>
  );
}
