"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Loader2, Save } from "lucide-react";
import { updateAutomationRule } from "./api";
import type { AutomationRule } from "./types";

export function AutomationRuleControls({ rule }: { rule: AutomationRule }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(rule.enabled);
  const [priority, setPriority] = useState(rule.priority);
  const [thresholdDays, setThresholdDays] = useState(valueToInput(rule.thresholdDays));
  const [thresholdHours, setThresholdHours] = useState(valueToInput(rule.thresholdHours));
  const [thresholdCount, setThresholdCount] = useState(valueToInput(rule.thresholdCount));
  const [windowDays, setWindowDays] = useState(valueToInput(rule.windowDays));
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSave() {
    setState("loading");
    setMessage(null);

    try {
      await updateAutomationRule(rule.id, {
        enabled,
        priority,
        thresholdCount: inputToNumber(thresholdCount),
        thresholdDays: inputToNumber(thresholdDays),
        thresholdHours: inputToNumber(thresholdHours),
        windowDays: inputToNumber(windowDays),
      });
      setState("success");
      setMessage("Regla actualizada.");
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar.");
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-3">
      <div className="grid gap-3 lg:grid-cols-[160px_1fr_140px]">
        <label className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2">
          <span className="text-sm font-semibold text-[#475467]">Activa</span>
          <input autoComplete="off"
            checked={enabled}
            className="h-5 w-5 accent-[#4f46e5]"
            onChange={(event) => setEnabled(event.target.checked)}
            type="checkbox"
          />
        </label>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {rule.thresholdDays !== null ? (
            <NumberField label="Dias antes" value={thresholdDays} onChange={setThresholdDays} />
          ) : null}
          {rule.thresholdHours !== null ? (
            <NumberField label="Horas espera" value={thresholdHours} onChange={setThresholdHours} />
          ) : null}
          {rule.thresholdCount !== null ? (
            <NumberField label="Cantidad" value={thresholdCount} onChange={setThresholdCount} />
          ) : null}
          {rule.windowDays !== null ? (
            <NumberField label="Ventana dias" value={windowDays} onChange={setWindowDays} />
          ) : null}
          <label className="grid gap-1">
            <span className="text-xs font-semibold text-[#667085]">Prioridad</span>
            <select
              className="h-10 rounded-xl border border-[#d6deea] bg-white px-3 text-sm outline-none transition focus:border-[#4f46e5] focus:ring-4 focus:ring-[#4f46e5]/10"
              onChange={(event) => setPriority(event.target.value as AutomationRule["priority"])}
              value={priority}
            >
              <option value="INFO">Info</option>
              <option value="WARNING">Atender</option>
              <option value="CRITICAL">Critica</option>
            </select>
          </label>
        </div>

        <button
          className="inline-flex h-10 items-center justify-center gap-2 self-end rounded-xl bg-[#4f46e5] px-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(79,70,229,0.18)] transition hover:bg-[#4338ca] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={state === "loading"}
          onClick={handleSave}
          type="button"
        >
          {state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : state === "success" ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          Guardar
        </button>
      </div>
      {message ? (
        <p className={`mt-2 text-xs font-semibold ${state === "error" ? "text-[#b42318]" : "text-[#0284c7]"}`}>
          {message}
        </p>
      ) : null}
    </div>
  );
}

function NumberField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-semibold text-[#667085]">{label}</span>
      <input autoComplete="off"
        className="h-10 rounded-xl border border-[#d6deea] bg-white px-3 text-sm outline-none transition focus:border-[#4f46e5] focus:ring-4 focus:ring-[#4f46e5]/10"
        min={1}
        onChange={(event) => onChange(event.target.value)}
        type="number"
        value={value}
      />
    </label>
  );
}

function valueToInput(value: number | null) {
  return value === null ? "" : String(value);
}

function inputToNumber(value: string) {
  const normalized = value.trim();
  return normalized.length > 0 ? Number(normalized) : null;
}
