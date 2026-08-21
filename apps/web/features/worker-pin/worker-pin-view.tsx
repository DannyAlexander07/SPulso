"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";
import { AlertCircle, KeyRound, ShieldCheck, UserCheck } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { selfUpdateAttendancePin } from "./api";

type FormState = "idle" | "loading" | "success" | "error";

const TENANT_SLUG = "grupo-sp";
const COMPANY_OPTIONS = [
  { label: "Grupo SP", value: "grupo-sp" },
  { label: "Mood", value: "mood" },
  { label: "Infinity", value: "infinity" },
  { label: "Supernova", value: "supernova" },
];

export function WorkerPinView() {
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const data = new FormData(form);

    setState("loading");
    setMessage("");

    try {
      const response = await selfUpdateAttendancePin({
        tenantSlug: TENANT_SLUG,
        companySlug: String(data.get("companySlug") ?? ""),
        identifier: String(data.get("identifier") ?? ""),
        currentPin: String(data.get("currentPin") ?? ""),
        newPin: String(data.get("newPin") ?? ""),
      });

      form.reset();
      setState("success");
      setMessage(response.message);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar el PIN.");
    }
  }

  return (
    <main className="min-h-dvh bg-[#f3f5f8] text-[#20242c]">
      <section className="mx-auto grid min-h-dvh max-w-5xl items-center gap-6 px-4 py-5 md:grid-cols-[0.9fr_1.1fr] lg:px-6">
        <div className="animate-rise">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#4f46e5] text-sm font-bold text-white shadow-[0_14px_30px_rgba(79,70,229,0.24)]">
              SP
            </div>
            <div>
              <p className="text-lg font-semibold">SPulso</p>
              <p className="text-sm text-[#667085]">Seguridad de marcacion</p>
            </div>
          </div>

          <div className="mt-8 rounded-[28px] border border-[#dfe5ee] bg-white p-5 shadow-[0_28px_80px_rgba(16,24,40,0.10)]">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e0f2fe] text-[#0284c7]">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <h1 className="mt-5 text-3xl font-semibold tracking-normal text-[#171b23]">
              Cambia tu PIN cuando lo necesites.
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#667085]">
              Selecciona tu empresa, usa tu codigo o DNI, confirma tu PIN actual y define uno nuevo de 4 a 8 digitos.
            </p>
            <div className="mt-5 rounded-2xl border border-[#fde68a] bg-[#fffbeb] p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-[#92400e]">
                <AlertCircle className="h-4 w-4" />
                ¿Olvidaste tu PIN?
              </p>
              <p className="mt-2 text-sm leading-6 text-[#92400e]">
                Por seguridad no se puede recuperar el PIN anterior. Pide a RRHH o a un administrador que lo resetee desde el panel administrativo.
              </p>
              <p className="mt-2 flex items-start gap-2 text-xs font-semibold leading-5 text-[#a16207]">
                <UserCheck className="mt-0.5 h-4 w-4 shrink-0" />
                Ruta interna: Trabajadores &gt; Ver perfil &gt; PIN de marcacion. Tambien se puede cambiar desde Usuarios al editar una cuenta vinculada a ficha laboral.
              </p>
            </div>
            <Link
              className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-[#eef2ff] px-4 text-sm font-semibold text-[#4f46e5] transition hover:bg-[#c7d2fe]"
              href="/marcacion"
            >
              Volver a marcacion
            </Link>
          </div>
        </div>

        <div className="animate-rise rounded-[28px] border border-[#dfe5ee] bg-white p-5 shadow-[0_28px_80px_rgba(16,24,40,0.10)]">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">
            PIN personal
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-normal text-[#171b23]">
            Actualizar PIN
          </h2>

          <form autoComplete="off" className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-[#667085]">Empresa</span>
              <select
                className="h-12 w-full rounded-2xl border border-[#d8dee8] bg-white px-4 text-base font-semibold outline-none transition focus:border-[#4f46e5] focus:ring-4 focus:ring-[#c7d2fe]"
                defaultValue=""
                name="companySlug"
                required
              >
                <option disabled value="">
                  Selecciona tu empresa
                </option>
                {COMPANY_OPTIONS.map((company) => (
                  <option key={company.value} value={company.value}>
                    {company.label}
                  </option>
                ))}
              </select>
            </label>
            <Field label="Codigo o DNI" name="identifier" placeholder="Ej. MO-002 o 70000001" />
            <Field label="PIN actual" name="currentPin" placeholder="PIN actual" />
            <Field label="Nuevo PIN" name="newPin" placeholder="Nuevo PIN" />

            <button
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#4f46e5] px-4 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(79,70,229,0.24)] transition hover:-translate-y-0.5 hover:bg-[#4338ca] disabled:cursor-not-allowed disabled:opacity-70"
              disabled={state === "loading"}
              type="submit"
            >
              <KeyRound className="h-4 w-4" />
              {state === "loading" ? "Actualizando..." : "Actualizar PIN"}
            </button>

            <div className="min-h-9">
              {state === "loading" ? <ActionFeedback message="Validando PIN actual..." tone="loading" /> : null}
              {state === "success" ? <ActionFeedback message={message} tone="success" /> : null}
              {state === "error" ? <ActionFeedback message={message} tone="error" /> : null}
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}

function Field({
  label,
  name,
  placeholder,
}: {
  label: string;
  name: string;
  placeholder: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-[#667085]">{label}</span>
      <input
        autoComplete="off"
        className="h-12 w-full rounded-2xl border border-[#d8dee8] bg-white px-4 text-base font-semibold outline-none transition placeholder:text-[#98a2b3] focus:border-[#4f46e5] focus:ring-4 focus:ring-[#c7d2fe]"
        inputMode="numeric"
        maxLength={name === "identifier" ? undefined : 8}
        minLength={name === "identifier" ? undefined : 4}
        name={name}
        placeholder={placeholder}
        required
        type={name === "identifier" ? "text" : "password"}
      />
    </label>
  );
}
