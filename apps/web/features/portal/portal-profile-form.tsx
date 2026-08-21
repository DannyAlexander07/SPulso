"use client";

import { Loader2, Pencil, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { updatePortalProfile } from "./api";
import type { PortalEmployee } from "./types";

export function PortalProfileForm({ employee }: { employee: PortalEmployee }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    setIsSaving(true);
    setMessage("");

    try {
      await updatePortalProfile({
        address: String(data.get("address") ?? ""),
        personalEmail: String(data.get("personalEmail") ?? ""),
        phoneMobile: String(data.get("phoneMobile") ?? ""),
      });
      setIsEditing(false);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar tu ficha.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!isEditing) {
    return (
      <div>
        <div className="grid gap-3 md:grid-cols-2">
          <ReadOnlyField label="Correo personal" value={employee.personalEmail ?? "Pendiente"} />
          <ReadOnlyField label="Celular" value={employee.phoneMobile ?? "Pendiente"} />
          <ReadOnlyField label="Direccion" value={employee.address ?? "Pendiente"} />
        </div>
        <button
          className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#4f46e5] px-4 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(79,70,229,0.22)] transition hover:bg-[#4338ca]"
          onClick={() => setIsEditing(true)}
          type="button"
        >
          <Pencil className="h-4 w-4" />
          Editar datos permitidos
        </button>
      </div>
    );
  }

  return (
    <form autoComplete="off" className="space-y-3" onSubmit={handleSubmit}>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-xs font-semibold text-[#667085]">Correo personal</span>
          <input autoComplete="off" className={inputClassName} defaultValue={employee.personalEmail ?? ""} name="personalEmail" placeholder="correo.personal@email.com" type="email" />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-semibold text-[#667085]">Celular</span>
          <input autoComplete="off" className={inputClassName} defaultValue={employee.phoneMobile ?? ""} name="phoneMobile" placeholder="Ej. 999999999" />
        </label>
        <label className="space-y-1.5 md:col-span-2">
          <span className="text-xs font-semibold text-[#667085]">Direccion</span>
          <input autoComplete="off" className={inputClassName} defaultValue={employee.address ?? ""} name="address" placeholder="Direccion actual" />
        </label>
      </div>

      <p className="min-h-5 text-sm text-[#b42318]">{message}</p>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#dfe5ee] px-4 text-sm font-semibold text-[#475467] hover:bg-[#f8fafc]"
          disabled={isSaving}
          onClick={() => setIsEditing(false)}
          type="button"
        >
          <X className="h-4 w-4" />
          Cancelar
        </button>
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#4f46e5] px-4 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(79,70,229,0.22)] transition hover:bg-[#4338ca] disabled:opacity-60"
          disabled={isSaving}
          type="submit"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar cambios
        </button>
      </div>
    </form>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-3">
      <p className="text-xs font-semibold text-[#667085]">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

const inputClassName =
  "h-11 w-full rounded-2xl border border-[#d8dee8] bg-white px-3 text-sm outline-none transition placeholder:text-[#98a2b3] focus:border-[#4f46e5] focus:ring-4 focus:ring-[#c7d2fe]";
