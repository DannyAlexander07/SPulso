"use client";

import { KeyRound, Loader2, LogIn, Mail, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { getDefaultWorkspacePath } from "./access";
import { login } from "./api";

type FormState = "idle" | "loading" | "error";

export function LoginForm() {
  const router = useRouter();
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const data = new FormData(event.currentTarget);

    setState("loading");
    setMessage("");

    try {
      const session = await login(
        String(data.get("email") ?? ""),
        String(data.get("password") ?? ""),
      );

      router.replace(getDefaultWorkspacePath(session.user));
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error ? error.message : "No se pudo iniciar sesión.",
      );
    }
  }

  return (
    <form
      autoComplete="off"
      className="mt-6 space-y-3.5"
      method="post"
      onSubmit={handleSubmit}
    >
      <label className="block space-y-1.5">
        <span className="text-xs font-semibold text-[#667085]">Correo</span>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98a2b3]" />
          <input
            autoComplete="off"
            className={inputClassName}
            name="email"
            placeholder="correo@empresa.com"
            type="email"
            required
          />
        </div>
      </label>
      <label className="block space-y-1.5">
        <span className="text-xs font-semibold text-[#667085]">Contraseña</span>
        <div className="relative">
          <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98a2b3]" />
          <input
            autoComplete="off"
            className={inputClassName}
            name="password"
            placeholder="Contraseña"
            type="password"
            required
          />
        </div>
      </label>
      <p className="min-h-5 text-sm text-[#b42318]">
        {state === "error" ? message : ""}
      </p>
      <button
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#4f46e5] px-4 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(79,70,229,0.24)] transition hover:-translate-y-0.5 hover:bg-[#4338ca] disabled:cursor-not-allowed disabled:opacity-70"
        disabled={state === "loading"}
        type="submit"
      >
        {state === "loading" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <LogIn className="h-4 w-4" />
        )}
        {state === "loading" ? "Ingresando..." : "Ingresar"}
      </button>
      <div className="flex items-start gap-3 rounded-xl border border-[#e1e5eb] bg-[#f8fafc] p-3 text-xs leading-5 text-[#667085]">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#e0f2fe] text-[#0284c7]">
          <ShieldCheck className="h-4 w-4" />
        </span>
        <div>
          <p className="font-semibold text-[#344054]">
            Software monitoreado y seguro
          </p>
          <p>Acceso protegido con permisos, auditoria y control por rol.</p>
        </div>
      </div>
    </form>
  );
}

const inputClassName =
  "h-11 w-full rounded-xl border border-[#d8dee8] bg-white pl-10 pr-3 text-sm outline-none transition placeholder:text-[#98a2b3] focus:border-[#4f46e5] focus:ring-4 focus:ring-[#c7d2fe]";
