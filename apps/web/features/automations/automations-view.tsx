import {
  AlertTriangle,
  BellRing,
  Clock3,
  FileClock,
  FileSignature,
  FileWarning,
  MapPin,
  Power,
  Sparkles,
} from "lucide-react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { Badge } from "@/components/ui/badge";
import { CrudSection } from "@/components/ui/crud-section";
import { MetricCard } from "@/components/ui/surface";
import type { AuthUser } from "@/features/auth/types";
import { AutomationRuleControls } from "./automation-rule-controls";
import type { AutomationRule, AutomationRuleType } from "./types";

export function AutomationsView({
  currentUser,
  rules,
}: {
  currentUser: AuthUser | null;
  rules: AutomationRule[];
}) {
  const enabledRules = rules.filter((rule) => rule.enabled);
  const criticalRules = rules.filter((rule) => rule.priority === "CRITICAL");

  return (
    <main className="min-h-screen bg-[#f4f6f8] text-[#1f242d]">
      <div className="grid min-h-screen lg:grid-cols-[216px_minmax(0,1fr)]">
        <AppSidebar activePath="/automatizaciones" currentUser={currentUser} />

        <section className="min-w-0">
          <AppTopbar currentUser={currentUser} eyebrow="Automatizaciones" title="Reglas inteligentes" />

          <div className="mx-auto max-w-7xl px-4 py-4 pb-24 sm:px-5 lg:px-6 lg:pb-4">
            <section className="grid gap-3 lg:grid-cols-3">
              <MetricCard icon={Sparkles} label="Reglas creadas" value={rules.length.toString()} />
              <MetricCard icon={Power} label="Reglas activas" tone="success" value={enabledRules.length.toString()} />
              <MetricCard icon={AlertTriangle} label="Criticas" tone="danger" value={criticalRules.length.toString()} />
            </section>

            <CrudSection
              actions={
                  <div className="rounded-2xl border border-[#c7d2fe] bg-[#f7f7ff] px-4 py-3 text-sm text-[#4f46e5]">
                    <p className="font-semibold">Se aplican al grupo completo</p>
                    <p className="mt-1 text-xs text-[#475467]">Luego podremos hacer reglas por empresa.</p>
                  </div>
              }
              className="mt-4"
              description="Define cuando SPulso debe levantar alertas. El sistema revisa documentos, firmas, solicitudes y asistencia usando estos parametros."
              eyebrow="Motor de reglas"
              title="Automatizaciones configurables"
            >
              <div className="grid gap-4">
                {rules.map((rule, index) => (
                  <RuleCard index={index} key={rule.id} rule={rule} />
                ))}
              </div>
            </CrudSection>
          </div>
        </section>
      </div>
    </main>
  );
}

function RuleCard({ index, rule }: { index: number; rule: AutomationRule }) {
  const Icon = ruleIcon(rule.type);

  return (
    <article
      className="animate-rise rounded-2xl border border-[#e1e5eb] bg-white p-4 shadow-sm"
      style={{ animationDelay: `${index * 55}ms` }}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${priorityIconClass(rule.priority)}`}>
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold">{rule.name}</h3>
              <Badge tone={rule.enabled ? "success" : "neutral"}>
                {rule.enabled ? "Activa" : "Pausada"}
              </Badge>
              <Badge tone={priorityBadgeTone(rule.priority)}>
                {priorityLabel(rule.priority)}
              </Badge>
            </div>
            <p className="mt-1 text-sm leading-6 text-[#667085]">{rule.description}</p>
            <p className="mt-2 text-xs font-semibold text-[#475467]">{ruleReadableConfig(rule)}</p>
          </div>
        </div>
      </div>

      <AutomationRuleControls rule={rule} />
    </article>
  );
}

function ruleIcon(type: AutomationRuleType) {
  const icons = {
    ATTENDANCE_LATE_REPEATED: MapPin,
    DOCUMENT_EXPIRED: FileWarning,
    DOCUMENT_EXPIRING: FileClock,
    DOCUMENT_PENDING_SIGNATURE: FileSignature,
    REQUEST_PENDING: Clock3,
  };

  return icons[type];
}

function ruleReadableConfig(rule: AutomationRule) {
  if (rule.type === "DOCUMENT_EXPIRING") {
    return `Avisar ${rule.thresholdDays ?? 30} dias antes del vencimiento.`;
  }

  if (rule.type === "REQUEST_PENDING") {
    return `Escalar cuando una solicitud supere ${rule.thresholdHours ?? 48} horas pendiente.`;
  }

  if (rule.type === "ATTENDANCE_LATE_REPEATED") {
    return `Avisar con ${rule.thresholdCount ?? 3} tardanzas en ${rule.windowDays ?? 7} dias.`;
  }

  return "Se ejecuta cuando el sistema detecta el caso.";
}

function priorityLabel(priority: AutomationRule["priority"]) {
  const labels = {
    CRITICAL: "Critica",
    INFO: "Info",
    WARNING: "Atender",
  };

  return labels[priority];
}

function priorityBadgeTone(priority: AutomationRule["priority"]) {
  const tones = {
    CRITICAL: "danger",
    INFO: "brand",
    WARNING: "warning",
  };

  return tones[priority] as "brand" | "danger" | "warning";
}

function priorityIconClass(priority: AutomationRule["priority"]) {
  const classes = {
    CRITICAL: "bg-[#fee4e2] text-[#b42318]",
    INFO: "bg-[#eef2ff] text-[#4f46e5]",
    WARNING: "bg-[#fff7df] text-[#b86b00]",
  };

  return classes[priority];
}
