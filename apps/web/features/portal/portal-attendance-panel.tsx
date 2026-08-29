"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";
import type { AttendanceRecord } from "@/features/attendance/types";
import { AttendanceSuccessCard } from "@/features/worker-attendance/attendance-success-card";
import { selfMarkAttendance } from "@/features/worker-attendance/api";
import {
  requestBrowserLocation,
  type BrowserLocation,
} from "@/features/worker-attendance/location-utils";
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

type FormState = "idle" | "loading" | "success" | "error";
type MarkAction = "CHECK_IN" | "CHECK_OUT";

export function PortalAttendancePanel({
  companySlug,
  identifier,
  userAvatarUrl,
  tenantSlug = "grupo-sp",
}: {
  companySlug: string;
  identifier: string;
  userAvatarUrl?: string | null;
  tenantSlug?: string;
}) {
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!location) {
      setState("error");
      setMessage("Primero activa tu ubicacion para registrar la marcacion.");
      return;
    }

    const data = new FormData(event.currentTarget);
    setState("loading");
    setMessage("");
    setRecord(null);

    try {
      const nextRecord = await selfMarkAttendance({
        tenantSlug,
        companySlug,
        identifier,
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
      event.currentTarget.reset();
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
    <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-[26px] border border-[#dfe5ee] bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">
            Jornada de hoy
          </p>
          <Link
            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[#d8dee8] bg-white px-3 text-xs font-semibold text-[#475467] transition hover:border-[#4f46e5] hover:text-[#4f46e5]"
            href="/portal"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Link>
        </div>
        <div className="mt-3 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-semibold tracking-normal text-[#171b23]">
              {currentTime}
            </h1>
            <p className="mt-2 text-sm text-[#667085]">
              Marcacion con GPS obligatorio y PIN personal.
            </p>
          </div>
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e0f2fe] text-[#0284c7]">
            <ShieldCheck className="h-5 w-5" />
          </span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <InfoCard icon={Clock3} label="Hora" value="En vivo" />
          <InfoCard
            icon={LocateFixed}
            label="Ubicacion"
            value={locationState === "ready" ? locationMessage : "Pendiente"}
          />
          <InfoCard icon={ShieldCheck} label="PIN" value="Obligatorio" />
        </div>
        <LocationControl
          locationMessage={locationMessage}
          locationState={locationState}
          onActivate={activateLocation}
        />
      </section>

      <section className="rounded-[26px] border border-[#dfe5ee] bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">
          Registrar marca
        </p>
        <h2 className="mt-2 text-2xl font-semibold">Entrada o salida</h2>

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
              Acepto el registro puntual de mi ubicación al marcar asistencia.
              SPulso no realiza seguimiento continuo. Aviso GPS v. 29/08/2026.
            </span>
          </label>

          <button
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#4f46e5] px-4 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(79,70,229,0.24)] transition hover:bg-[#4338ca] disabled:cursor-not-allowed disabled:opacity-70"
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
          className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-[#f8fafc] px-4 text-sm font-semibold text-[#475467] transition hover:bg-[#eef2f7]"
          href="/cambiar-pin"
        >
          Cambiar mi PIN de marcacion
        </Link>

        {record ? (
          <div className="mt-3">
            <AttendanceSuccessCard
              action={selectedAction}
              avatarUrl={userAvatarUrl}
              locationLabel={location?.label ?? "Ubicacion GPS validada"}
              record={record}
            />
          </div>
        ) : null}
      </section>
    </div>
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
