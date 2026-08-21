import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/ui";

export function Surface({
  children,
  className,
  compact = false,
}: {
  children: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <section
      className={cn(
        "animate-rise rounded-[18px] border border-[#e1e5eb] bg-white/95 shadow-[0_8px_24px_rgba(15,23,42,0.035)] backdrop-blur-sm transition duration-200 hover:border-[#c8d2e0] hover:shadow-[0_14px_34px_rgba(15,23,42,0.055)]",
        compact ? "p-3.5" : "p-4",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function SectionHeader({
  action,
  description,
  eyebrow,
  icon: Icon,
  title,
}: {
  action?: ReactNode;
  description?: ReactNode;
  eyebrow?: string;
  icon?: ElementType;
  title: string;
}) {
  return (
    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#667085]">
            {eyebrow}
          </p>
        ) : null}
        <div className="mt-1 flex min-w-0 items-center gap-2">
          {Icon ? (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#eef2ff] text-[#4f46e5]">
              <Icon className="h-4 w-4" />
            </span>
          ) : null}
          <h2 className="whitespace-normal break-words text-lg font-semibold leading-6 tracking-normal text-[#1f242d]">{title}</h2>
        </div>
        {description ? <p className="mt-1 text-sm leading-5 text-[#667085]">{description}</p> : null}
      </div>
      {action ? <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">{action}</div> : null}
    </div>
  );
}

export function MetricCard({
  icon: Icon,
  label,
  tone = "brand",
  value,
}: {
  icon?: ElementType;
  label: string;
  tone?: "brand" | "success" | "warning" | "danger" | "neutral";
  value: string;
}) {
  const tones = {
    brand: "bg-[#eef2ff] text-[#4f46e5]",
    danger: "bg-[#fee4e2] text-[#b42318]",
    neutral: "bg-[#f2f4f7] text-[#667085]",
    success: "bg-[#e0f2fe] text-[#0369a1]",
    warning: "bg-[#fff7df] text-[#b86b00]",
  };

  return (
    <article className="animate-rise rounded-[18px] border border-[#e1e5eb] bg-white/95 p-3.5 shadow-[0_8px_22px_rgba(15,23,42,0.035)] transition duration-200 hover:-translate-y-0.5 hover:border-[#c8d2e0] hover:shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
      <div className="flex items-center justify-between gap-2.5">
        <div className="min-w-0">
          <p className="whitespace-normal break-words text-[13px] font-medium leading-5 text-[#667085]">{label}</p>
          <p className="mt-1.5 whitespace-normal break-words text-xl font-semibold leading-6 tracking-normal text-[#1f242d]">{value}</p>
        </div>
        {Icon ? (
          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px]", tones[tone])}>
            <Icon className="h-[18px] w-[18px]" />
          </span>
        ) : null}
      </div>
    </article>
  );
}
