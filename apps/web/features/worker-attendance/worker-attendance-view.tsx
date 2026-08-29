"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";
import type { AttendanceRecord } from "@/features/attendance/types";
import {
  ArrowLeft,
  Clock3,
  Loader2,
  LocateFixed,
  LogIn,
  LogOut,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AttendanceSuccessCard } from "./attendance-success-card";
import { selfMarkAttendance } from "./api";
import { requestBrowserLocation, type BrowserLocation } from "./location-utils";

type FormState = "idle" | "loading" | "success" | "error";
type MarkAction = "CHECK_IN" | "CHECK_OUT";

const TENANT_SLUG = "grupo-sp";
const COMPANY_OPTIONS = [
  { label: "Grupo SP", value: "grupo-sp" },
  { label: "Mood", value: "mood" },
  { label: "Infinity", value: "infinity" },
  { label: "Supernova", value: "supernova" },
];

export function WorkerAttendanceView() {
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");
  const [selectedAction, setSelectedAction] = useState<MarkAction>("CHECK_IN");
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const [location, setLocation] = useState<BrowserLocation | null>(null);
  const [locationState, setLocationState] = useState<
    "idle" | "loading" | "ready" | "blocked" | "error"
  >("idle");
  const [locationMessage, setLocationMessage] = useState(
    "Activa tu ubicacion para marcar",
  );
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);

    return () => window.clearInterval(timer);
  }, []);

  async function activateLocation() {
    setLocationState("loading");
    setLocationMessage("Solicitando permiso de ubicacion...");
    setMessage("");

    try {
      const nextLocation = await requestBrowserLocation();
      setLocation(nextLocation);
      setLocationState("ready");
      setLocationMessage(nextLocation.label);
    } catch (error) {
      const failure = error as { blocked?: boolean; message?: string };
      setLocation(null);
      setLocationState(failure.blocked ? "blocked" : "error");
      setLocationMessage(failure.message ?? "No pudimos activar la ubicacion.");
    }
  }

  const currentTime = useMemo(
    () =>
      now
        ? new Intl.DateTimeFormat("es-PE", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }).format(now)
        : "--:--:--",
    [now],
  );

  const currentDate = useMemo(
    () =>
      now
        ? new Intl.DateTimeFormat("es-PE", {
            weekday: "long",
            day: "2-digit",
            month: "long",
          }).format(now)
        : "Cargando fecha",
    [now],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!location) {
      setState("error");
      setMessage("Primero activa tu ubicacion para registrar la marcacion.");
      return;
    }

    const form = event.currentTarget;
    const data = new FormData(form);

    setState("loading");
    setMessage("");
    setRecord(null);

    try {
      const nextRecord = await selfMarkAttendance({
        tenantSlug: TENANT_SLUG,
        companySlug: String(data.get("companySlug") ?? ""),
        identifier: String(data.get("identifier") ?? ""),
        pin: String(data.get("pin") ?? ""),
        action: selectedAction,
        latitude: location.latitude,
        longitude: location.longitude,
        locationConsent: data.get("locationConsent") === "on",
        privacyNoticeVersion: "gps-2026-08-29",
      });

      setRecord(nextRecord);
      setState("success");
      setMessage(
        selectedAction === "CHECK_IN"
          ? "Entrada registrada correctamente."
          : "Salida registrada correctamente.",
      );
      form.reset();
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo registrar la marcacion.",
      );
    }
  }

  return (
    <main className="min-h-dvh bg-[#f3f5f8] text-[#20242c]">
      <section className="mx-auto grid min-h-dvh max-w-6xl items-center gap-6 px-4 py-5 md:grid-cols-[0.92fr_1.08fr] lg:px-6">
        <div className="animate-rise">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#4f46e5] text-sm font-bold text-white shadow-[0_14px_30px_rgba(79,70,229,0.24)]">
              SP
            </div>
            <div>
              <p className="text-lg font-semibold">SPulso</p>
              <p className="text-sm text-[#667085]">Marcacion del trabajador</p>
            </div>
            <Link
              className="ml-auto inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#d8dee8] bg-white px-3 text-sm font-semibold text-[#475467] transition hover:border-[#4f46e5] hover:text-[#4f46e5]"
              href="/seleccionar-panel"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver al panel
            </Link>
          </div>

          <div className="mt-8 rounded-[28px] border border-[#dfe5ee] bg-white p-5 shadow-[0_28px_80px_rgba(16,24,40,0.10)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">
                  Jornada de hoy
                </p>
                <h1 className="mt-2 text-4xl font-semibold tracking-normal text-[#171b23]">
                  {currentTime}
                </h1>
                <p className="mt-1 capitalize text-sm text-[#667085]">
                  {currentDate}
                </p>
              </div>
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e0f2fe] text-[#0284c7]">
                <ShieldCheck className="h-5 w-5" />
              </span>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <InfoCard icon={Clock3} label="Entrada" value="Codigo o DNI" />
              <InfoCard icon={LogOut} label="Salida" value="Una vez al dia" />
              <InfoCard
                icon={LocateFixed}
                label="Ubicacion"
                value={
                  locationState === "ready" ? locationMessage : "Pendiente"
                }
              />
            </div>
            <LocationControl
              locationMessage={locationMessage}
              locationState={locationState}
              onActivate={activateLocation}
            />
          </div>
        </div>

        <div className="animate-rise rounded-[28px] border border-[#dfe5ee] bg-white p-5 shadow-[0_28px_80px_rgba(16,24,40,0.10)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">
                Registrar marca
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-normal text-[#171b23]">
                Entrada o salida
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#667085]">
                Selecciona tu empresa, ingresa tu codigo o DNI, PIN y ubicacion
                GPS obligatoria.
              </p>
            </div>
          </div>

          <form
            autoComplete="off"
            className="mt-5 space-y-4"
            onSubmit={handleSubmit}
          >
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#f3f5f8] p-1.5">
              <ActionSwitch
                active={selectedAction === "CHECK_IN"}
                icon={LogIn}
                label="Entrada"
                onClick={() => setSelectedAction("CHECK_IN")}
              />
              <ActionSwitch
                active={selectedAction === "CHECK_OUT"}
                icon={LogOut}
                label="Salida"
                onClick={() => setSelectedAction("CHECK_OUT")}
              />
            </div>

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-[#667085]">
                Empresa
              </span>
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

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-[#667085]">
                Codigo o DNI
              </span>
              <input
                autoComplete="off"
                className="h-12 w-full rounded-2xl border border-[#d8dee8] bg-white px-4 text-base font-semibold outline-none transition placeholder:text-[#98a2b3] focus:border-[#4f46e5] focus:ring-4 focus:ring-[#c7d2fe]"
                name="identifier"
                placeholder="Ej. MO-002 o 70000001"
                required
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-[#667085]">
                PIN de marcacion
              </span>
              <input
                autoComplete="off"
                className="h-12 w-full rounded-2xl border border-[#d8dee8] bg-white px-4 text-base font-semibold outline-none transition placeholder:text-[#98a2b3] focus:border-[#4f46e5] focus:ring-4 focus:ring-[#c7d2fe]"
                inputMode="numeric"
                maxLength={8}
                minLength={6}
                name="pin"
                placeholder="Ej. 1234"
                required
                type="password"
              />
            </label>

            <div className="flex items-center gap-2 rounded-2xl border border-[#e1e5eb] bg-[#f8fafc] px-3 py-2 text-xs font-semibold text-[#667085]">
              <LocateFixed
                className={`h-4 w-4 ${location ? "text-[#0284c7]" : "text-[#b86b00]"}`}
              />
              {locationMessage}
            </div>

            <label className="flex items-start gap-3 rounded-2xl border border-[#dbe3ee] bg-[#f8fafc] p-3 text-xs leading-5 text-[#475467]">
              <input
                className="mt-1 h-4 w-4 accent-[#4f46e5]"
                name="locationConsent"
                required
                type="checkbox"
              />
              <span>
                Acepto que SPulso registre mi ubicación puntual al marcar
                entrada o salida para validar asistencia. No se realiza
                seguimiento continuo. Aviso GPS v. 29/08/2026.
              </span>
            </label>

            <button
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#4f46e5] px-4 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(79,70,229,0.24)] transition hover:-translate-y-0.5 hover:bg-[#4338ca] disabled:cursor-not-allowed disabled:opacity-70"
              disabled={state === "loading" || !location}
              type="submit"
            >
              {state === "loading" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : selectedAction === "CHECK_IN" ? (
                <LogIn className="h-4 w-4" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              {state === "loading" ? "Registrando..." : "Registrar marcacion"}
            </button>

            <div className="min-h-9">
              {state === "loading" ? (
                <ActionFeedback
                  message="Validando trabajador..."
                  tone="loading"
                />
              ) : null}
              {state === "success" ? (
                <ActionFeedback message={message} tone="success" />
              ) : null}
              {state === "error" ? (
                <ActionFeedback message={message} tone="error" />
              ) : null}
            </div>
          </form>

          <Link
            className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-xl bg-[#f8fafc] px-4 text-sm font-semibold text-[#475467] transition hover:bg-[#eef2f7]"
            href="/cambiar-pin"
          >
            Cambiar mi PIN de marcacion
          </Link>

          {record ? (
            <AttendanceSuccessCard
              action={selectedAction}
              locationLabel={location?.label ?? "Ubicacion GPS validada"}
              record={record}
            />
          ) : null}
        </div>
      </section>
    </main>
  );
}

function ActionSwitch({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition ${
        active
          ? "bg-white text-[#4f46e5] shadow-sm"
          : "text-[#667085] hover:bg-white/70 hover:text-[#20242c]"
      }`}
      onClick={onClick}
      type="button"
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function LocationControl({
  locationMessage,
  locationState,
  onActivate,
}: {
  locationMessage: string;
  locationState: "idle" | "loading" | "ready" | "blocked" | "error";
  onActivate: () => void;
}) {
  const isLoading = locationState === "loading";

  return (
    <div className="mt-4 rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#344054]">
            Ubicacion para asistencia
          </p>
          <p className="mt-1 whitespace-normal break-words text-xs leading-5 text-[#667085]">
            {locationMessage}
          </p>
        </div>
        <button
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#d8dee8] bg-white px-3 text-sm font-semibold text-[#475467] transition hover:border-[#4f46e5] hover:bg-[#eef2ff] hover:text-[#4f46e5] disabled:opacity-60"
          disabled={isLoading}
          onClick={onActivate}
          type="button"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {locationState === "ready"
            ? "Actualizar ubicacion"
            : "Activar ubicacion"}
        </button>
      </div>
      {locationState === "blocked" ? (
        <p className="mt-3 rounded-xl bg-[#fff7ed] px-3 py-2 text-xs font-semibold leading-5 text-[#b45309]">
          Si la ubicacion fue rechazada, abre el candado junto a la URL, permite
          Ubicacion y presiona nuevamente.
        </p>
      ) : null}
    </div>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-3">
      <Icon className="h-4 w-4 text-[#4f46e5]" />
      <p className="mt-2 text-xs font-semibold text-[#667085]">{label}</p>
      <p className="mt-1 whitespace-normal break-words text-sm font-semibold leading-5">
        {value}
      </p>
    </div>
  );
}
